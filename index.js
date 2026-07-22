// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🦄 Beautiful Edition 🦄                    ║
// ║              Developed by Charuka Mahesh                     ║
// ║     Dedicated to Umesha Sathyanjali | Mithila | Sharada     ║
// ║                  Version: 9.0.1 ✨                           ║
// ╚══════════════════════════════════════════════════════════════╝

const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const mongoose = require('mongoose');
const config = require('./config');
const fetchAllLatestNews = require('./news/fetchAll');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText, smartTruncate } = require('./news/utils');

// ============================================================
// 🎵 VOICE REPLIES
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
// ⚙️ CONFIGURATION
// ============================================================
const OWNER_NUMBERS = Array.isArray(config.ownerNumber) ? config.ownerNumber : [config.ownerNumber];
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
// 🗄️ JSON DATABASE
// ============================================================
const JSON_DB_FILE = path.join(__dirname, 'database.json');
let useMongo = false;
let jsonDb = { settings: { botMode: 'public', prefix: '.', autoNewsEnabled: true, autoStatusView: true, autoStatusReact: true, autoStatusSave: false, voiceReplyEnabled: true, autoBioEnabled: true, antiLinkEnabled: false, welcomeEnabled: false, goodbyeEnabled: false }, warnings: {}, bans: [], afk: {}, groupSettings: {}, sentUrls: [] };

function loadJsonDb() {
    try { if (fs.existsSync(JSON_DB_FILE)) { const d = JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8')); jsonDb = { settings: { ...jsonDb.settings, ...(d.settings || {}) }, warnings: d.warnings || {}, bans: d.bans || [], afk: d.afk || {}, groupSettings: d.groupSettings || {}, sentUrls: d.sentUrls || [] }; } else saveJsonDb(); } catch (e) { saveJsonDb(); }
}
function saveJsonDb() { try { fs.writeFileSync(JSON_DB_FILE, JSON.stringify(jsonDb, null, 2)); } catch (e) {} }
loadJsonDb();

// ============================================================
// 🍃 MONGODB
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
            await mongoose.connect(mongoUrl, { dbName: config.dbName || 'newsbot_db', serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, ssl: false, tls: false, tlsAllowInvalidCertificates: true, tlsAllowInvalidHostnames: true });
            Setting = mongoose.model('Setting', settingSchema); Warning = mongoose.model('Warning', warningSchema);
            Ban = mongoose.model('Ban', banSchema); Afk = mongoose.model('Afk', afkSchema);
            GroupSetting = mongoose.model('GroupSetting', groupSettingSchema); NewsUrl = mongoose.model('NewsUrl', newsUrlSchema);
            useMongo = true; console.log('✅ MongoDB'); return true;
        } catch (e) { console.log('⚠️ MongoDB failed'); if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {}); }
    }
    useMongo = false; loadJsonDb(); console.log('🗄️ JSON DB'); return false;
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
// 🎨 UI
// ============================================================
const randEmoji = (a) => a[Math.floor(Math.random() * a.length)];

// ============================================================
// 🔐 AUTH
// ============================================================
let sock = null, reconnectTimer = null, reconnectAttempts = 0, isConnected = false, isShuttingDown = false;
let lastStatusTime = 0, ownerJid = null, lastStatusMessages = [];

function isOwner(senderNumber, senderJid) {
    const cleanNumber = senderNumber.replace(/[^0-9]/g, '');
    for (const owner of OWNER_NUMBERS) {
        const cleanOwner = owner.replace(/[^0-9]/g, '');
        if (cleanNumber === cleanOwner) return true;
        if (cleanNumber.length >= 9 && cleanOwner.length >= 9 && cleanNumber.slice(-9) === cleanOwner.slice(-9)) return true;
    }
    if (ownerJid && senderJid && senderJid === ownerJid) return true;
    return false;
}

async function checkAdmin(jid, sender) {
    try { const m = await sock.groupMetadata(jid); return m.participants.find(p => p.id === sender)?.admin != null; } catch { return false; }
}

// ============================================================
// 📥 MEDIA
// ============================================================
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

// ============================================================
// 🎵 VOICE
// ============================================================
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
// 🖤 STATUS
// ============================================================
async function handleStatus(msg) {
    if (!sock) return;
    try {
        const { key } = msg; if (key.fromMe) return;
        const p = key.participant || key.remoteJid; if (!p || p === sock.user?.id) return;
        if (Date.now() - lastStatusTime < 2000) return; lastStatusTime = Date.now();
        lastStatusMessages.push({ msg, timestamp: Date.now(), participant: p });
        if (lastStatusMessages.length > 50) lastStatusMessages = lastStatusMessages.slice(-50);
        if (await db.get('autoStatusView', true)) { await sock.readMessages([key]); console.log('👁️ Status viewed'); }
        if (await db.get('autoStatusReact', true)) {
            const emoji = randEmoji(STATUS_EMOJIS);
            try { await sock.sendMessage(p, { react: { text: emoji, key: key } }); console.log('❤️ Status reacted:', emoji); } catch (e) {
                try { await sock.sendMessage('status@broadcast', { react: { text: emoji, key: key } }); } catch (e2) {}
            }
        }
    } catch (e) {}
}

// ============================================================
// 📰 SEND NEWS
// ============================================================
async function sendNewsToJid(jid, article, sendReaction = true) {
    if (!sock?.user) return false;
    let desc = article.description || article.title || '📰 Click to read';
    desc = cleanNewsText(desc); if (isGarbageDescription(desc)) desc = article.title;
    desc = fixLineBreaks(desc); desc = smartTruncate(desc, 2500);
    desc = desc.replace(/\. /g, '.\n\n').replace(/\? /g, '?\n\n').replace(/\! /g, '!\n\n').replace(/। /g, '।\n\n');
    desc = desc.split('\n').filter(p => p.trim().length > 0).join('\n\n');
    const cap = ['╭' + '─'.repeat(40) + '╮', '┃  📰 *' + article.source + '*', '┃  📂 ' + article.category, '╰' + '─'.repeat(40) + '╯', '', '📌 *' + article.title + '*', '', '─'.repeat(40), '', desc, '', '─'.repeat(40), '', article.date ? '📅 ' + article.date : '', '🔗 ' + article.url, '', '💝 *NewsBot LK* | Charuka Mahesh'].filter(l => l !== '').join('\n');
    try {
        let sent = null; let imgUrl = article.image || FALLBACK_IMAGE;
        if (imgUrl && imgUrl.length > 10 && !imgUrl.includes('undefined') && !imgUrl.includes('null')) {
            try { const ir = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }); if (ir.data?.length > 1000) sent = await sock.sendMessage(jid, { image: ir.data, caption: cap, mimetype: 'image/jpeg' }); } catch (e) {}
        }
        if (!sent) { try { const lr = await axios.get(BOT_LOGO, { responseType: 'arraybuffer', timeout: 10000 }); if (lr.data?.length > 1000) sent = await sock.sendMessage(jid, { image: lr.data, caption: cap, mimetype: 'image/png' }); } catch (e) {} }
        if (!sent) sent = await sock.sendMessage(jid, { text: cap });
        if (sent && sendReaction) await sock.sendMessage(jid, { react: { text: randEmoji(REACTIONS), key: sent.key } });
        return true;
    } catch (e) { try { await sock.sendMessage(jid, { text: cap }); return true; } catch (e2) { return false; } }
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
// 🎨 BEAUTIFUL MENUS
// ============================================================
async function sendMenu(jid, isOwner, isAdmin, isGroup, prefix) {
    const mode = await db.get('botMode', 'public');
    const me = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };
    const ve = await db.get('voiceReplyEnabled', true);
    
    const menu = [
        '┏' + '━'.repeat(28) + '┓',
        '┃     💝 *NEWS BOT LK* 💝     ┃',
        '┃   🦄 *Sri Lanka #1* 🦄     ┃',
        '┃    ' + me[mode] + ' Mode: *' + mode.toUpperCase() + '*      ┃',
        '┗' + '━'.repeat(28) + '┛',
        '',
        '╔' + '═'.repeat(34) + '╗',
        '║     📰 *NEWS COMMANDS* 📰       ║',
        '╚' + '═'.repeat(34) + '╝',
        '  ✦ ' + prefix + 'news    ─ 📰 Latest News',
        '  ✦ ' + prefix + 'stats   ─ 📊 Statistics',
        '',
        '╔' + '═'.repeat(34) + '╗',
        '║     💾 *MEDIA COMMANDS* 💾       ║',
        '╚' + '═'.repeat(34) + '╝',
        '  ✦ ' + prefix + 'save    ─ 💾 Save Content',
        '  ✦ ' + prefix + 'statussave ─ 📱 Status (Owner)',
        '  ✦ ' + prefix + 'vv      ─ 👁️ View-Once',
        '',
        '╔' + '═'.repeat(34) + '╗',
        '║     🎵 *VOICE COMMANDS* 🎵       ║',
        '╚' + '═'.repeat(34) + '╝',
        '  ✦ Voice: ' + (ve ? '✅ *ON*' : '❌ *OFF*'),
        '  ✦ ' + prefix + 'voice on/off ─ Toggle Voice',
        '',
        '╔' + '═'.repeat(34) + '╗',
        '║     👥 *GROUP COMMANDS* 👥       ║',
        '╚' + '═'.repeat(34) + '╝',
        '  ✦ ' + prefix + 'admins    ─ 👑 List Admins',
        '  ✦ ' + prefix + 'groupinfo ─ 📋 Group Info',
        '  ✦ ' + prefix + 'tagall    ─ 📢 Tag All',
        '  ✦ ' + prefix + 'poll      ─ 📊 Create Poll',
        '  ✦ ' + prefix + 'afk       ─ 💤 AFK Mode',
    ];
    
    if (isAdmin || isOwner) {
        menu.push(
            '',
            '╔' + '═'.repeat(34) + '╗',
            '║     🛡️ *ADMIN COMMANDS* 🛡️      ║',
            '╚' + '═'.repeat(34) + '╝',
            '  ✦ mute / unmute ─ 🔇 Toggle',
            '  ✦ warn / kick   ─ ⚠️ Moderate',
            '  ✦ antilink      ─ 🔗 Protection',
            '  ✦ welcome       ─ 👋 Greetings',
            '  ✦ goodbye       ─ 😢 Farewell'
        );
    }
    
    if (isOwner) {
        menu.push(
            '',
            '╔' + '═'.repeat(34) + '╗',
            '║     💎 *OWNER COMMANDS* 💎       ║',
            '╚' + '═'.repeat(34) + '╝',
            '  ✦ ' + prefix + 'settings    ─ ⚙️ Configure',
            '  ✦ ' + prefix + 'mode        ─ 🌍 Bot Mode',
            '  ✦ ' + prefix + 'autonews    ─ 📰 Auto News',
            '  ✦ ' + prefix + 'autostatus  ─ 🖤 Auto Status',
            '  ✦ ' + prefix + 'ban/unban   ─ 🚫 Manage Users',
            '  ✦ ' + prefix + 'broadcast   ─ 📢 Mass Message'
        );
    }
    
    menu.push(
        '',
        '━'.repeat(38),
        '👨‍💻 *Dev:* Charuka Mahesh | v' + (config.version || '9.0.1'),
        '━'.repeat(38),
        '',
        '💝 *Umesha Sathyanjali*',
        '💝 *Mithila & Sharada*'
    );
    
    const caption = menu.join('\n');
    
    try {
        const lr = await axios.get(BOT_LOGO, { responseType: 'arraybuffer', timeout: 10000 });
        if (lr.data?.length > 1000) {
            const s = await sock.sendMessage(jid, { image: lr.data, caption: caption, mimetype: 'image/png' });
            await sock.sendMessage(jid, { react: { text: '📋', key: s.key } });
        } else {
            const s = await sock.sendMessage(jid, { text: caption });
            await sock.sendMessage(jid, { react: { text: '📋', key: s.key } });
        }
    } catch (e) {
        const s = await sock.sendMessage(jid, { text: caption });
        await sock.sendMessage(jid, { react: { text: '📋', key: s.key } });
    }
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
        '  💾 Auto Save: ' + (s.autoStatusSave ? '✅ *ON*' : '❌ *OFF*'),
        '  🎵 Voice: ' + (ve ? '✅ *ON*' : '❌ *OFF*'),
        '  🔗 Anti-Link: ' + (s.antiLinkEnabled ? '✅ *ON*' : '❌ *OFF*'),
        '',
        '🔧 Prefix: *' + (s.prefix || '.') + '*',
        '🗄️ DB: JSON',
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
    if (!isOwner) {
        await sock.sendMessage(jid, { text: '╔' + '═'.repeat(28) + '╗\n║    ❌ *Owner Only!*    ║\n╚' + '═'.repeat(28) + '╝' });
        return;
    }
    
    const s = await db.all();
    const bans = await db.banAll();
    const mode = s.botMode || 'public';
    const me = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };
    
    const msg = [
        '┏' + '━'.repeat(28) + '┓',
        '┃     ⚙️ *SETTINGS* ⚙️      ┃',
        '┃     💝 *NewsBot LK* 💝      ┃',
        '┗' + '━'.repeat(28) + '┛',
        '',
        '╔' + '═'.repeat(30) + '╗',
        '║       📰 *NEWS*             ║',
        '╚' + '═'.repeat(30) + '╝',
        '  Auto News: ' + (s.autoNewsEnabled ? '✅ ON' : '❌ OFF'),
        '',
        '╔' + '═'.repeat(30) + '╗',
        '║       🖤 *STATUS*           ║',
        '╚' + '═'.repeat(30) + '╝',
        '  Auto View: ' + (s.autoStatusView ? '✅ ON' : '❌ OFF'),
        '  Auto React: ' + (s.autoStatusReact ? '✅ ON' : '❌ OFF'),
        '  Auto Save: ' + (s.autoStatusSave ? '✅ ON' : '❌ OFF'),
        '',
        '╔' + '═'.repeat(30) + '╗',
        '║       🎵 *VOICE*            ║',
        '╚' + '═'.repeat(30) + '╝',
        '  Voice Replies: ' + (s.voiceReplyEnabled ? '✅ ON' : '❌ OFF'),
        '',
        '╔' + '═'.repeat(30) + '╗',
        '║       🔒 *SECURITY*         ║',
        '╚' + '═'.repeat(30) + '╝',
        '  Anti-Link: ' + (s.antiLinkEnabled ? '✅ ON' : '❌ OFF'),
        '',
        '╔' + '═'.repeat(30) + '╗',
        '║       👥 *GROUP*            ║',
        '╚' + '═'.repeat(30) + '╝',
        '  Welcome: ' + (s.welcomeEnabled ? '✅ ON' : '❌ OFF'),
        '  Goodbye: ' + (s.goodbyeEnabled ? '✅ ON' : '❌ OFF'),
        '',
        '╔' + '═'.repeat(30) + '╗',
        '║       🔧 *SYSTEM*           ║',
        '╚' + '═'.repeat(30) + '╝',
        '  Prefix: *' + (s.prefix || '.') + '*',
        '  Mode: ' + (me[mode] || '🌍') + ' *' + mode.toUpperCase() + '*',
        '  Banned: *' + (Array.isArray(bans) ? bans.length : 0) + '*',
        '',
        '💡 *Toggle Commands:*',
        '  .autonews on/off',
        '  .autostatus on/off',
        '  .voice on/off',
        '  .mode public/private',
    ].join('\n');
    
    try {
        const lr = await axios.get(BOT_LOGO, { responseType: 'arraybuffer', timeout: 10000 });
        if (lr.data?.length > 1000) {
            const se = await sock.sendMessage(jid, { image: lr.data, caption: msg, mimetype: 'image/png' });
            await sock.sendMessage(jid, { react: { text: '⚙️', key: se.key } });
        } else {
            const se = await sock.sendMessage(jid, { text: msg });
            await sock.sendMessage(jid, { react: { text: '⚙️', key: se.key } });
        }
    } catch (e) {
        const se = await sock.sendMessage(jid, { text: msg });
        await sock.sendMessage(jid, { react: { text: '⚙️', key: se.key } });
    }
}

async function sendConnectedMessage() {
    if (!ownerJid || !sock) return;
    await new Promise(r => setTimeout(r, 3000));
    try {
        const bn = sock.user?.id?.split('@')[0] || 'Unknown';
        const ve = await db.get('voiceReplyEnabled', true);
        const msg = ['╔' + '═'.repeat(36) + '╗', '║     💝 *NEWS BOT LK* 💝      ║', '║   🦄 *Connected!* 🦄        ║', '╚' + '═'.repeat(36) + '╝', '', '✅ *Online* | 🆔 ' + bn, '📰 *.news* | 📋 *.menu*', '🎵 Voice: ' + (ve ? 'ON' : 'OFF'), '📰 Sources: 13 | 📝 32 Articles', '', '💝 Umesha | Mithila | Sharada'].join('\n');
        try { const lr = await axios.get(BOT_LOGO, { responseType: 'arraybuffer', timeout: 10000 }); if (lr.data?.length > 1000) await sock.sendMessage(ownerJid, { image: lr.data, caption: msg, mimetype: 'image/png' }); else await sock.sendMessage(ownerJid, { text: msg }); } catch (e) { await sock.sendMessage(ownerJid, { text: msg }); }
    } catch (e) {}
}

// ============================================================
// 🤖 MAIN BOT
// ============================================================
async function startBot() {
    if (sock) { try { sock.end(); } catch {} sock = null; }
    const baileys = await import('@whiskeysockets/baileys');
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = baileys;
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));
    
    sock = makeWASocket({
        auth: state, browser: Browsers.macOS('Chrome'), markOnlineOnConnect: true,
        connectTimeoutMs: 30000, printQRInTerminal: false, syncFullHistory: false,
        retryRequestDelayMs: 5000, maxRetries: 5, defaultQueryTimeoutMs: 60000,
        generateHighQualityLinkPreview: false,
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            try {
                if (!msg.message) continue;
                const jid = msg.key.remoteJid;
                if (jid === 'status@broadcast') { await handleStatus(msg); continue; }

                let rawText = '';
                if (msg.message.conversation) rawText = msg.message.conversation;
                else if (msg.message.extendedTextMessage?.text) rawText = msg.message.extendedTextMessage.text;
                else if (msg.message.imageMessage?.caption) rawText = msg.message.imageMessage.caption;
                else if (msg.message.videoMessage?.caption) rawText = msg.message.videoMessage.caption;
                if (!rawText) continue;

                const text = rawText.trim(), lower = text.toLowerCase();
                const isGroup = jid.endsWith('@g.us');
                const sender = msg.key.participant || jid;
                let senderNum = sender.split('@')[0].replace(/[^0-9]/g, '');

                if (isGroup) {
                    const idsToCheck = [msg.key.participant, msg.key.participantAlt, msg.key.remoteJid, msg.key.remoteJidAlt].filter(Boolean);
                    for (const id of idsToCheck) {
                        const num = id.split('@')[0].replace(/[^0-9]/g, '');
                        for (const owner of OWNER_NUMBERS) {
                            const co = owner.replace(/[^0-9]/g, '');
                            if (num === co || (num.length >= 9 && co.length >= 9 && num.slice(-9) === co.slice(-9))) { senderNum = co; break; }
                        }
                    }
                }

                const isUserOwner = isOwner(senderNum, sender);
                const isAdmin = isGroup ? await checkAdmin(jid, sender) : false;
                const prefix = await db.get('prefix', '.');

                if (await db.banCheck(sender) && !isUserOwner) continue;
                if (!isGroup && await db.get('voiceReplyEnabled', true)) { if (await handleVoiceReply(jid, text, msg, isUserOwner)) continue; }

                // === COMMANDS ===
                if (lower === 'voice on' || lower === '.voice on') { await db.set('voiceReplyEnabled', true); await sock.sendMessage(jid, { text: '🎵 *Voice: ON*' }); continue; }
                if (lower === 'voice off' || lower === '.voice off') { await db.set('voiceReplyEnabled', false); await sock.sendMessage(jid, { text: '🔇 *Voice: OFF*' }); continue; }
                if (lower === '.menu' || lower === 'menu' || lower === 'help') { await sendMenu(jid, isUserOwner, isAdmin, isGroup, prefix); continue; }
                if (lower === '.stats' || lower === 'stats') { await sendStats(jid); continue; }
                if (lower === '.settings' || lower === 'settings') { await sendSettings(jid, isUserOwner); continue; }
                if (lower === '.news' || lower === 'news') { await sendNewsCommand(jid, isGroup); continue; }

                if (lower === '.save' || lower === 'save' || lower === '.ss') {
                    const qm = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!qm) { await sock.sendMessage(jid, { text: '💡 Reply to media with *save*' }); continue; }
                    try { const fm = { key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'f_' + Date.now() }, message: qm }; const sv = await saveMediaToFile(fm); await sock.sendMessage(jid, { text: sv ? '💾 *Saved!*' : '❌ *Failed!*' }); } catch (e) { await sock.sendMessage(jid, { text: '❌ *Error!*' }); }
                    continue;
                }

                if (lower === '.statussave' || lower === 'statussave' || lower === '.ssave') {
                    if (!isUserOwner) { await sock.sendMessage(jid, { text: '❌ *Owner Only!*' }); continue; }
                    if (!lastStatusMessages.length) { await sock.sendMessage(jid, { text: '📭 *No statuses!*' }); continue; }
                    try { const sv = await saveMediaToFile(lastStatusMessages[lastStatusMessages.length - 1].msg, STATUS_FOLDER); await sock.sendMessage(jid, { text: sv ? '💾 *Saved!*' : '❌ *Failed!*' }); } catch (e) { await sock.sendMessage(jid, { text: '❌ *Error!*' }); }
                    continue;
                }

                if (lower === '.vv' || lower === 'vv') {
                    const qm = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!qm) { await sock.sendMessage(jid, { text: '💡 Reply to view-once with *vv*' }); continue; }
                    const mt = Object.keys(qm)[0];
                    if (!mt?.includes('viewOnce') && !mt?.includes('view_once')) { await sock.sendMessage(jid, { text: '❌ Not view-once!' }); continue; }
                    try { let rm = qm; if (mt.includes('viewOnce') || mt.includes('view_once')) { const im = qm[mt]?.message; if (im) rm = im; } const fm = { key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'vv_' + Date.now() }, message: rm }; await saveMediaToFile(fm, VV_FOLDER); await sock.sendMessage(jid, { text: '✅ *VV Saved!*' }); } catch (e) { await sock.sendMessage(jid, { text: '❌ *Error!*' }); }
                    continue;
                }

                if (isGroup) {
                    if (lower === '.admins' || lower === 'admins') { try { const m = await sock.groupMetadata(jid); const ad = m.participants.filter(p => p.admin); await sock.sendMessage(jid, { text: '👑 *Admins*\n\n' + ad.map(p => '@' + p.id.split('@')[0]).join('\n'), mentions: ad.map(p => p.id) }); } catch(e) {} continue; }
                    if (lower === '.groupinfo' || lower === 'groupinfo' || lower === '.gcinfo') { try { const m = await sock.groupMetadata(jid); await sock.sendMessage(jid, { text: '📋 *' + m.subject + '*\n👥 ' + m.participants.length + ' members' }); } catch(e) {} continue; }
                    if (lower === '.tagall' || lower === 'tagall' || lower === '.everyone') { try { const m = await sock.groupMetadata(jid); await sock.sendMessage(jid, { text: '📢 *Everyone!*', mentions: m.participants.map(p => p.id) }); } catch(e) {} continue; }
                    if (lower.startsWith('.poll ') || lower.startsWith('poll ')) { const q = text.replace('.poll','').replace('poll','').trim(); await sock.sendMessage(jid, { poll: { name: '📊 ' + q, values: ['👍 Yes','👎 No','🤔 Maybe'], selectableCount: 1 } }); continue; }
                    if (lower.startsWith('.afk') || lower.startsWith('afk ')) { const r = text.replace('.afk','').replace('afk','').trim() || 'AFK'; await db.afkSet(sender, r); await sock.sendMessage(jid, { text: '💤 @' + sender.split('@')[0] + ' *AFK:* ' + r, mentions: [sender] }); continue; }

                    if (isAdmin || isUserOwner) {
                        if (lower === '.mute' || lower === 'mute') { await db.groupSet(jid, 'isMuted', true); await sock.sendMessage(jid, { text: '🔇 *Muted 30min*' }); setTimeout(async () => { await db.groupSet(jid, 'isMuted', false); }, 1800000); continue; }
                        if (lower === '.unmute' || lower === 'unmute') { await db.groupSet(jid, 'isMuted', false); await sock.sendMessage(jid, { text: '🔊 *Unmuted!*' }); continue; }
                        if (lower.startsWith('.warn ') || lower.startsWith('warn ')) { const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (men?.length) { const c = await db.warnAdd(men[0], jid); await sock.sendMessage(jid, { text: '⚠️ @' + men[0].split('@')[0] + ' *Warn ' + c + '/3*', mentions: [men[0]] }); if (c >= 3) { try { await sock.groupParticipantsUpdate(jid, [men[0]], 'remove'); await db.warnClear(men[0], jid); } catch(e) {} } } continue; }
                        if (lower.startsWith('.kick ') || lower.startsWith('kick ')) { const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (men?.length) { try { await sock.groupParticipantsUpdate(jid, [men[0]], 'remove'); await sock.sendMessage(jid, { text: '🚫 *Kicked!*' }); } catch(e) {} } continue; }
                        if (lower.startsWith('.add ') || lower.startsWith('add ')) { const num = text.replace('.add','').replace('add','').trim().replace(/[^0-9]/g,''); if (num) { try { await sock.groupParticipantsUpdate(jid, [num + '@s.whatsapp.net'], 'add'); await sock.sendMessage(jid, { text: '✅ *Added!*' }); } catch(e) {} } continue; }
                        if (lower.startsWith('.promote ') || lower.startsWith('promote ')) { const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (men?.length) { try { await sock.groupParticipantsUpdate(jid, [men[0]], 'promote'); await sock.sendMessage(jid, { text: '👑 *Promoted!*' }); } catch(e) {} } continue; }
                        if (lower.startsWith('.demote ') || lower.startsWith('demote ')) { const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (men?.length) { try { await sock.groupParticipantsUpdate(jid, [men[0]], 'demote'); await sock.sendMessage(jid, { text: '⬇️ *Demoted!*' }); } catch(e) {} } continue; }
                        if (lower === '.welcome on') { await db.set('welcomeEnabled', true); await sock.sendMessage(jid, { text: '✅ *Welcome ON*' }); continue; }
                        if (lower === '.welcome off') { await db.set('welcomeEnabled', false); await sock.sendMessage(jid, { text: '❌ *Welcome OFF*' }); continue; }
                        if (lower === '.goodbye on') { await db.set('goodbyeEnabled', true); await sock.sendMessage(jid, { text: '✅ *Goodbye ON*' }); continue; }
                        if (lower === '.goodbye off') { await db.set('goodbyeEnabled', false); await sock.sendMessage(jid, { text: '❌ *Goodbye OFF*' }); continue; }
                        if (lower === '.antilink on') { await db.set('antiLinkEnabled', true); await sock.sendMessage(jid, { text: '🔗 *Anti-Link ON*' }); continue; }
                        if (lower === '.antilink off') { await db.set('antiLinkEnabled', false); await sock.sendMessage(jid, { text: '🔗 *Anti-Link OFF*' }); continue; }
                    }
                }

                if (isUserOwner) {
                    if (lower === '.mode' || lower.startsWith('.mode ') || lower === 'mode' || lower.startsWith('mode ')) { const ma = text.replace('.mode','').replace('mode','').trim().toLowerCase(); const vm = ['private','inbox','groups','public']; const me = { private:'🔒', inbox:'📥', groups:'👥', public:'🌍' }; if (vm.includes(ma)) { await db.set('botMode', ma); await sock.sendMessage(jid, { text: me[ma] + ' *Mode: ' + ma.toUpperCase() + '*' }); } else { const cm = await db.get('botMode','public'); await sock.sendMessage(jid, { text: me[cm] + ' *Current: ' + cm.toUpperCase() + '*\n💡 mode public' }); } continue; }
                    if (lower === '.autonews on') { await db.set('autoNewsEnabled', true); await sock.sendMessage(jid, { text: '📰 *Auto News: ON*' }); continue; }
                    if (lower === '.autonews off') { await db.set('autoNewsEnabled', false); await sock.sendMessage(jid, { text: '📰 *Auto News: OFF*' }); continue; }
                    if (lower === '.autostatus on') { await db.set('autoStatusView', true); await db.set('autoStatusReact', true); await sock.sendMessage(jid, { text: '🖤 *Auto Status: ON*' }); continue; }
                    if (lower === '.autostatus off') { await db.set('autoStatusView', false); await db.set('autoStatusReact', false); await db.set('autoStatusSave', false); await sock.sendMessage(jid, { text: '🖤 *Auto Status: OFF*' }); continue; }
                    if (lower.startsWith('.ban ') || lower.startsWith('ban ')) { const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (men?.length) { await db.banAdd(men[0]); await sock.sendMessage(jid, { text: '🚫 @' + men[0].split('@')[0] + ' *banned!*', mentions: [men[0]] }); } continue; }
                    if (lower.startsWith('.unban ') || lower.startsWith('unban ')) { const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (men?.length) { await db.banRemove(men[0]); await sock.sendMessage(jid, { text: '✅ @' + men[0].split('@')[0] + ' *unbanned!*', mentions: [men[0]] }); } continue; }
                    if (lower === '.banlist' || lower === 'banlist') { const bl = await db.banAll(); if (!bl.length) await sock.sendMessage(jid, { text: '✅ *No bans!*' }); else { const list = bl.map((b,i) => (i+1) + '. @' + b.userId.split('@')[0]).join('\n'); await sock.sendMessage(jid, { text: '🚫 *Banned (' + bl.length + ')*\n' + list, mentions: bl.map(b => b.userId) }); } continue; }
                    if (lower.startsWith('.broadcast ') || lower.startsWith('broadcast ')) { const bm = text.replace('.broadcast','').replace('broadcast','').trim(); try { const gs = await sock.groupFetchAllParticipating(); let c = 0; for (const gid of Object.keys(gs)) { try { await sock.sendMessage(gid, { text: '📢 *Broadcast*\n\n' + bm }); c++; await new Promise(r=>setTimeout(r,1000)); } catch(e) {} } await sock.sendMessage(jid, { text: '📢 *Sent to ' + c + ' groups!*' }); } catch(e) {} continue; }
                }

                if (isGroup && await db.get('antiLinkEnabled', false) && !isAdmin && !isUserOwner) { if (/https?:\/\/(?:chat\.whatsapp\.com|t\.me|discord\.gg)/i.test(text)) { try { await sock.sendMessage(jid, { delete: msg.key }); } catch(e) {} await sock.sendMessage(jid, { text: '🔗 *Link Deleted!*' }); continue; } }
                if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) { for (const m of msg.message.extendedTextMessage.contextInfo.mentionedJid) { const a = await db.afkGet(m); if (a) { const mins = Math.floor((Date.now() - new Date(a.afkAt).getTime()) / 60000); await sock.sendMessage(jid, { text: '💤 @' + m.split('@')[0] + ' *AFK:* ' + a.reason + ' (' + mins + 'm)', mentions: [m] }); } } }
                if (await db.afkGet(sender) && !lower.startsWith('afk') && !lower.startsWith('.afk')) { await db.afkRemove(sender); }

            } catch (e) {}
        }
    });

    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (action === 'add' && await db.get('welcomeEnabled', false)) { for (const p of participants) await sock.sendMessage(id, { text: '🎉 *Welcome!*\n👋 @' + p.split('@')[0], mentions: [p] }); }
        if (action === 'remove' && await db.get('goodbyeEnabled', false)) { for (const p of participants) await sock.sendMessage(id, { text: '😢 *Goodbye!*\n👋 @' + p.split('@')[0], mentions: [p] }); }
    });

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) { console.log('\n📱 Scan QR:\n'); qrcode.generate(qr, { small: true }); }
        if (connection === 'close') { isConnected = false; sock = null; const sc = lastDisconnect?.error?.output?.statusCode; if (sc !== DisconnectReason.loggedOut && !isShuttingDown) { reconnectAttempts++; const d = Math.min(10000, 2000 * reconnectAttempts); reconnectTimer = setTimeout(async () => { reconnectTimer = null; if (!isShuttingDown) await startBot(); }, d); } }
        else if (connection === 'open') { isConnected = true; reconnectAttempts = 0; if (sock.user) ownerJid = sock.user.id.replace(/:.*/, '') + '@s.whatsapp.net'; console.log('\n💝 Connected! 👑 Owners: ' + OWNER_NUMBERS.join(', ') + '\n'); if (ownerJid) await sendConnectedMessage(); if (await db.get('autoNewsEnabled', true)) await checkAndShareAllNewNews(); }
    });
    sock.ev.on('creds.update', saveCreds);
}

(async () => {
    console.log('\n💝 NewsBot LK v' + (config.version || '9.0.1') + ' 💝');
    console.log('👨‍💻 ' + (config.developer || 'Charuka Mahesh'));
    console.log('👑 Config Owners: ' + OWNER_NUMBERS.join(', '));
    await connectDatabase(); await db.set('botMode', 'public'); await db.set('autoStatusSave', false);
    console.log('🌍 Public Mode\n');
    await startBot();
    setInterval(async () => { if (await db.get('autoNewsEnabled', true)) await checkAndShareAllNewNews(); }, CHECK_INTERVAL_MS);
    console.log('🦄💝 Bot Running! 💝🦄\n');
})();
