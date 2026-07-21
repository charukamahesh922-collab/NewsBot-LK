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
[SAVE_FOLDER, STATUS_FOLDER, VV_FOLDER].forEach(f => {
    if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true });
});

// ============================================================
// 🗄️ JSON DATABASE
// ============================================================
const JSON_DB_FILE = path.join(__dirname, 'database.json');
let useMongo = false;
let jsonDb = {
    settings: { botMode: 'public', prefix: '.', autoNewsEnabled: true, autoStatusView: true, autoStatusReact: true, autoStatusSave: false, voiceReplyEnabled: true, autoBioEnabled: true, antiLinkEnabled: false, welcomeEnabled: false, goodbyeEnabled: false },
    warnings: {}, bans: [], afk: {}, groupSettings: {}, sentUrls: []
};

function loadJsonDb() {
    try { if (fs.existsSync(JSON_DB_FILE)) { const d = JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8')); jsonDb = { settings: { ...jsonDb.settings, ...(d.settings || {}) }, warnings: d.warnings || {}, bans: d.bans || [], afk: d.afk || {}, groupSettings: d.groupSettings || {}, sentUrls: d.sentUrls || [] }; } else saveJsonDb(); } catch (e) { saveJsonDb(); }
}
function saveJsonDb() { try { fs.writeFileSync(JSON_DB_FILE, JSON.stringify(jsonDb, null, 2)); } catch (e) {} }
loadJsonDb();

// ============================================================
// 🍃 MONGODB (optional)
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
        } catch (e) { console.log('⚠️ MongoDB failed, using JSON'); if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {}); }
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
// 🎨 UI HELPERS
// ============================================================
const beautifulFooter = () => ['', '╭' + '─'.repeat(35) + '╮', '┃  🦄💝 *NewsBot LK* 💝🦄  ┃', '┃   💝 *Charuka Mahesh* 💝   ┃', '╰' + '─'.repeat(35) + '╯', '', '💝 *Umesha Sathyanjali* 💝', '💝 *Mithila & Sharada* 💝'].join('\n');
const sectionDivider = (t, e) => { const l = '─'.repeat(8); return `\n${e} ${l} *${t}* ${l} ${e}\n`; };
const statusBadge = (e) => e ? '✅ *ON*' : '❌ *OFF*';
const randEmoji = (a) => a[Math.floor(Math.random() * a.length)];

// ============================================================
// 🔐 AUTHENTICATION
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
// 📥 MEDIA DOWNLOAD & SAVE
// ============================================================
async function downloadMedia(msg) {
    try {
        const baileys = await import('@whiskeysockets/baileys');
        const buffer = await baileys.downloadMediaMessage(msg, 'buffer', {}, {
            logger: { info: () => {}, error: () => {}, warn: () => {} }
        });
        return (buffer && buffer.length > 100) ? buffer : null;
    } catch (e) {
        console.error('❌ downloadMedia error:', e.message);
        return null;
    }
}

async function saveMediaToFile(msg, folder = SAVE_FOLDER) {
    try {
        let realMessage = msg;
        let messageType = Object.keys(msg.message || {})[0];
        if (!messageType) return null;

        // Handle view-once wrapper
        if (messageType.includes('viewOnce') || messageType.includes('view_once')) {
            const innerMsg = msg.message[messageType]?.message;
            if (innerMsg) {
                realMessage = { ...msg, message: innerMsg };
                messageType = Object.keys(innerMsg)[0];
            }
        }

        const extensionMap = {
            'imageMessage': '.jpg',
            'videoMessage': '.mp4',
            'audioMessage': '.ogg',
            'stickerMessage': '.webp',
            'documentMessage': '.bin'
        };

        const extension = extensionMap[messageType] || '.bin';

        const buffer = await downloadMedia(realMessage);
        if (!buffer || buffer.length < 100) return null;

        const filename = `media_${Date.now()}${extension}`;
        const filePath = path.join(folder, filename);
        fs.writeFileSync(filePath, buffer);

        return { buffer, type: messageType, ext: extension, filename, filePath };
    } catch (e) {
        console.error('❌ saveMediaToFile error:', e.message);
        return null;
    }
}

// ============================================================
// 🎵 VOICE REPLIES
// ============================================================
async function handleVoiceReply(jid, text, msg, isUserOwner) {
    if (isUserOwner) return false;
    if (!await db.get('voiceReplyEnabled', true)) return false;
    if (!voiceReplies.replies || Object.keys(voiceReplies.replies).length === 0) return false;

    const lower = text.toLowerCase(), words = lower.split(/\s+/);
    for (const [trigger, url] of Object.entries(voiceReplies.replies)) {
        const tl = trigger.toLowerCase(); let matched = false;
        if (lower === tl) matched = true;
        else if (words.includes(tl)) matched = true;
        else if (tl.includes(' ') && lower.includes(tl)) matched = true;

        if (matched) {
            try {
                const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
                const buf = Buffer.from(res.data);
                if (buf.length > 100) {
                    const sent = await sock.sendMessage(jid, {
                        audio: buf, mimetype: 'audio/mpeg', ptt: true
                    }, { quoted: msg });
                    await sock.sendMessage(jid, { react: { text: '🎵', key: sent.key } });
                    return true;
                }
            } catch (e) {}
            break;
        }
    }
    return false;
}

// ============================================================
// 🖤 STATUS HANDLER
// ============================================================
async function handleStatus(msg) {
    if (!sock) return;
    try {
        const { key } = msg;
        if (key.fromMe) return;

        const p = key.participant || key.remoteJid;
        if (!p || p === sock.user?.id) return;

        if (Date.now() - lastStatusTime < 2000) return;
        lastStatusTime = Date.now();

        lastStatusMessages.push({ msg, timestamp: Date.now(), participant: p });
        if (lastStatusMessages.length > 50) lastStatusMessages = lastStatusMessages.slice(-50);

        // Auto view
        if (await db.get('autoStatusView', true)) {
            await sock.readMessages([key]);
            console.log('👁️ Status viewed from:', p.split('@')[0]);
        }

        // Auto react
        if (await db.get('autoStatusReact', true)) {
            const emoji = randEmoji(STATUS_EMOJIS);
            try {
                await sock.sendMessage(p, { react: { text: emoji, key: key } });
                console.log('❤️ Status reacted:', emoji, 'on:', p.split('@')[0]);
            } catch (e) {
                try {
                    await sock.sendMessage('status@broadcast', { react: { text: emoji, key: key } });
                    console.log('❤️ Status reacted (broadcast):', emoji);
                } catch (e2) {
                    console.log('⚠️ Status react failed');
                }
            }
        }
    } catch (e) {
        console.log('⚠️ Status error:', e.message);
    }
}

// ============================================================
// 📰 SEND NEWS
// ============================================================
async function sendNewsToJid(jid, article, sendReaction = true) {
    if (!sock?.user) return false;
    let desc = article.description || article.title || '📰 Click to read';
    desc = cleanNewsText(desc);
    if (isGarbageDescription(desc)) desc = article.title;
    desc = fixLineBreaks(desc);
    desc = smartTruncate(desc, 2500);
    desc = desc.replace(/\. /g, '.\n\n').replace(/\? /g, '?\n\n').replace(/\! /g, '!\n\n').replace(/। /g, '।\n\n');
    desc = desc.split('\n').filter(p => p.trim().length > 0).join('\n\n');

    const caption = [
        '╭' + '─'.repeat(40) + '╮',
        '┃  📰 *' + article.source + '*',
        '┃  📂 ' + article.category,
        '╰' + '─'.repeat(40) + '╯',
        '',
        '📌 *' + article.title + '*',
        '',
        '─'.repeat(40),
        '',
        desc,
        '',
        '─'.repeat(40),
        '',
        article.date ? '📅 ' + article.date : '',
        '🔗 ' + article.url,
        '',
        beautifulFooter()
    ].filter(l => l !== '').join('\n');

    try {
        let sent = null;
        let imgUrl = article.image || FALLBACK_IMAGE;
        if (imgUrl && imgUrl.length > 10 && !imgUrl.includes('undefined') && !imgUrl.includes('null')) {
            try {
                const ir = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (ir.data?.length > 1000) sent = await sock.sendMessage(jid, { image: ir.data, caption: caption, mimetype: 'image/jpeg' });
            } catch (e) {}
        }
        if (!sent) {
            try {
                const lr = await axios.get(BOT_LOGO, { responseType: 'arraybuffer', timeout: 10000 });
                if (lr.data?.length > 1000) sent = await sock.sendMessage(jid, { image: lr.data, caption: caption, mimetype: 'image/png' });
            } catch (e) {}
        }
        if (!sent) sent = await sock.sendMessage(jid, { text: caption });
        if (sent && sendReaction) await sock.sendMessage(jid, { react: { text: randEmoji(REACTIONS), key: sent.key } });
        return true;
    } catch (e) {
        try { await sock.sendMessage(jid, { text: caption }); return true; } catch (e2) { return false; }
    }
}

async function sendNewsCommand(jid, isGroup) {
    if (!sock?.user) return;
    await sock.sendMessage(jid, { text: '📰 *Fetching news...* ⏳' });
    try {
        const all = await fetchAllLatestNews();
        if (!all.length) { await sock.sendMessage(jid, { text: '📭 *No news!*' }); return; }
        let s = 0;
        const max = isGroup ? 5 : 8;
        for (const a of all.slice(0, max)) {
            if (await sendNewsToJid(jid, a, true)) { s++; await new Promise(r => setTimeout(r, 2000)); }
        }
        await sock.sendMessage(jid, { text: '✅ *' + s + ' news sent!* 📊 Total: ' + all.length });
    } catch (e) { await sock.sendMessage(jid, { text: '❌ *Error!*' }); }
}

async function checkAndShareAllNewNews() {
    if (!sock?.user) return;
    if (await db.groupGet(NEWS_GROUP_JID, 'isMuted', false)) return;
    try {
        const all = await fetchAllLatestNews();
        if (!all.length) return;
        const urls = await db.urlsGet();
        if (!urls.length) { for (const i of all) { if (i.url) await db.urlsAdd(i.url); } return; }
        let s = 0;
        for (const i of all) {
            if (!i.url || urls.includes(i.url)) continue;
            if (await sendNewsToJid(NEWS_GROUP_JID, i, true)) { await db.urlsAdd(i.url); s++; }
            await new Promise(r => setTimeout(r, 3000));
        }
        if (s > 0) console.log('✅ ' + s + ' news sent');
    } catch (e) {}
}

// ============================================================
// 🎨 MENUS
// ============================================================
async function sendMenu(jid, isOwner, isAdmin, isGroup, prefix) {
    const mode = await db.get('botMode', 'public');
    const me = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };
    const ve = await db.get('voiceReplyEnabled', true);
    const m = [
        '╭─40╮', '┃       💝 *NEWS BOT LK* 💝       ┃', '┃   🦄 ✨ *Sri Lanka #1* ✨ 🦄   ┃',
        '┃     ' + me[mode] + ' Mode: ' + mode.toUpperCase() + '              ┃', '╰─40╯', '',
        sectionDivider('📰 NEWS', '📡'),
        '  ✦ ' + prefix + 'news    ─ Latest', '  ✦ ' + prefix + 'stats   ─ Stats', '',
        sectionDivider('💾 MEDIA', '📦'),
        '  ✦ ' + prefix + 'save    ─ Save', '  ✦ ' + prefix + 'statussave ─ Status (Owner)', '  ✦ ' + prefix + 'vv      ─ View-Once', '',
        sectionDivider('🎵 VOICE', '🎤'),
        '  ✦ Voice: ' + statusBadge(ve), '  ✦ ' + prefix + 'voice on/off', '',
        sectionDivider('👥 GROUP', '👑'),
        '  ✦ ' + prefix + 'admins/groupinfo/tagall', '  ✦ ' + prefix + 'poll/afk', ''
    ];
    if (isAdmin || isOwner) m.push(sectionDivider('🛡️ ADMIN', '⚔️'), '  ✦ mute/unmute/warn/kick', '  ✦ antilink/welcome/goodbye', '');
    if (isOwner) m.push(sectionDivider('👑 OWNER', '💎'), '  ✦ settings/mode/autonews', '  ✦ ban/unban/broadcast', '');
    m.push('━'.repeat(40), '👨‍💻 ' + (config.developer || 'Charuka Mahesh'), '📦 v' + (config.version || '9.0.1'), '', beautifulFooter());
    const cap = m.join('\n');
    try {
        const lr = await axios.get(BOT_LOGO, { responseType: 'arraybuffer', timeout: 10000 });
        if (lr.data?.length > 1000) {
            const s = await sock.sendMessage(jid, { image: lr.data, caption: cap, mimetype: 'image/png' });
            await sock.sendMessage(jid, { react: { text: '📋', key: s.key } });
        } else {
            const s = await sock.sendMessage(jid, { text: cap });
            await sock.sendMessage(jid, { react: { text: '📋', key: s.key } });
        }
    } catch (e) {
        const s = await sock.sendMessage(jid, { text: cap });
        await sock.sendMessage(jid, { react: { text: '📋', key: s.key } });
    }
}

async function sendStats(jid) {
    const s = await db.all(); const uc = await db.urlsCount(); const ve = await db.get('voiceReplyEnabled', true);
    const t = ['╭─38╮', '┃ 📊 STATISTICS ┃', '╰─38╯', '', '📰 Shared: *' + uc + '*', '📱 Status: *' + fs.readdirSync(STATUS_FOLDER).length + '*', '💾 Media: *' + fs.readdirSync(SAVE_FOLDER).length + '*', '🔄 Interval: *' + (CHECK_INTERVAL_MS / 1000) + 's*', '', '📰 News: ' + statusBadge(s.autoNewsEnabled), '🖤 Status: ' + statusBadge(s.autoStatusView), '🎵 Voice: ' + statusBadge(ve), '', beautifulFooter()].join('\n');
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

async function sendConnectedMessage() {
    if (!ownerJid || !sock) return;
    await new Promise(r => setTimeout(r, 3000));
    try {
        const bn = sock.user?.id?.split('@')[0] || 'Unknown';
        const ve = await db.get('voiceReplyEnabled', true);
        const msg = ['╔═40╗', '║     💝 *NEWS BOT LK* 💝        ║', '║  🦄 ✨ *Connected!* ✨ 🦄     ║', '╚═40╝', '', '✅ Online | 🆔 ' + bn, '📰 .news | 📋 .menu', '🎵 Voice: ' + (ve ? 'ON' : 'OFF'), '', beautifulFooter()].join('\n');
        try {
            const lr = await axios.get(BOT_LOGO, { responseType: 'arraybuffer', timeout: 10000 });
            if (lr.data?.length > 1000) await sock.sendMessage(ownerJid, { image: lr.data, caption: msg, mimetype: 'image/png' });
            else await sock.sendMessage(ownerJid, { text: msg });
        } catch (e) { await sock.sendMessage(ownerJid, { text: msg }); }
    } catch (e) {}
}

// ============================================================
// 🤖 MAIN BOT ENGINE
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

                // Handle status messages
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

                // Owner detection for group messages
                if (isGroup) {
                    const idsToCheck = [msg.key.participant, msg.key.participantAlt, msg.key.remoteJid, msg.key.remoteJidAlt].filter(Boolean);
                    for (const id of idsToCheck) {
                        const num = id.split('@')[0].replace(/[^0-9]/g, '');
                        for (const owner of OWNER_NUMBERS) {
                            const co = owner.replace(/[^0-9]/g, '');
                            if (num === co || (num.length >= 9 && co.length >= 9 && num.slice(-9) === co.slice(-9))) {
                                senderNum = co; break;
                            }
                        }
                    }
                }

                const isUserOwner = isOwner(senderNum, sender);
                const isAdmin = isGroup ? await checkAdmin(jid, sender) : false;
                const prefix = await db.get('prefix', '.');

                console.log('📩 [' + senderNum + '] "' + lower + '" | Owner:' + isUserOwner + ' | Admin:' + isAdmin);

                if (await db.banCheck(sender) && !isUserOwner) continue;
                if (!isGroup && await db.get('voiceReplyEnabled', true)) { if (await handleVoiceReply(jid, text, msg, isUserOwner)) continue; }

                // ============================================================
                // 📋 COMMANDS
                // ============================================================

                // Voice on/off
                if (lower === 'voice on' || lower === '.voice on') { await db.set('voiceReplyEnabled', true); await sock.sendMessage(jid, { text: '🎵 *Voice: ON*' }); continue; }
                if (lower === 'voice off' || lower === '.voice off') { await db.set('voiceReplyEnabled', false); await sock.sendMessage(jid, { text: '🔇 *Voice: OFF*' }); continue; }

                // Menu
                if (lower === '.menu' || lower === 'menu' || lower === 'help') { await sendMenu(jid, isUserOwner, isAdmin, isGroup, prefix); continue; }

                // Stats
                if (lower === '.stats' || lower === 'stats') { await sendStats(jid); continue; }

                // News
                if (lower === '.news' || lower === 'news') { await sendNewsCommand(jid, isGroup); continue; }

                // ============================================================
                // 💾 SAVE COMMAND - Save replied media
                // ============================================================
                if (lower === '.save' || lower === 'save' || lower === '.ss') {
                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!quotedMsg) {
                        await sock.sendMessage(jid, { text: '💡 *Reply to a photo, video, or sticker* with *save* to save it' });
                        continue;
                    }

                    try {
                        // Create fake message object from quoted message
                        const fakeMsg = {
                            key: {
                                remoteJid: jid,
                                id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'save_' + Date.now()
                            },
                            message: quotedMsg
                        };

                        const saved = await saveMediaToFile(fakeMsg);

                        if (saved) {
                            // Send the saved file back to chat
                            if (saved.type === 'imageMessage') {
                                await sock.sendMessage(jid, {
                                    image: saved.buffer,
                                    caption: '💾 *Saved!*\n📁 ' + saved.filename
                                });
                            } else if (saved.type === 'videoMessage') {
                                await sock.sendMessage(jid, {
                                    video: saved.buffer,
                                    caption: '💾 *Saved!*\n📁 ' + saved.filename
                                });
                            } else if (saved.type === 'stickerMessage') {
                                await sock.sendMessage(jid, { sticker: saved.buffer });
                                await sock.sendMessage(jid, { text: '💾 *Sticker Saved!*\n📁 ' + saved.filename });
                            } else if (saved.type === 'audioMessage') {
                                await sock.sendMessage(jid, {
                                    audio: saved.buffer,
                                    mimetype: 'audio/ogg',
                                    ptt: true
                                });
                                await sock.sendMessage(jid, { text: '💾 *Audio Saved!*\n📁 ' + saved.filename });
                            } else {
                                await sock.sendMessage(jid, {
                                    document: saved.buffer,
                                    fileName: saved.filename,
                                    mimetype: 'application/octet-stream'
                                });
                                await sock.sendMessage(jid, { text: '💾 *Saved!*\n📁 ' + saved.filename });
                            }
                            console.log('💾 Saved: ' + saved.filename);
                        } else {
                            await sock.sendMessage(jid, { text: '❌ *Failed to save!*\nThe media may have expired or is not downloadable.' });
                        }
                    } catch (e) {
                        console.error('❌ Save error:', e.message);
                        await sock.sendMessage(jid, { text: '❌ *Error saving!*\n' + e.message });
                    }
                    continue;
                }

                // ============================================================
                // 📱 STATUS SAVE - Owner only
                // ============================================================
                if (lower === '.statussave' || lower === 'statussave' || lower === '.ssave') {
                    if (!isUserOwner) { await sock.sendMessage(jid, { text: '❌ *Owner Only!*' }); continue; }
                    if (!lastStatusMessages.length) { await sock.sendMessage(jid, { text: '📭 *No recent statuses!*' }); continue; }

                    const lastStatus = lastStatusMessages[lastStatusMessages.length - 1];
                    try {
                        const saved = await saveMediaToFile(lastStatus.msg, STATUS_FOLDER);
                        if (saved) {
                            const sn = lastStatus.participant.split('@')[0].replace(/[^0-9]/g, '');
                            if (saved.type === 'imageMessage') {
                                await sock.sendMessage(jid, { image: saved.buffer, caption: '📱 *Status Saved!*\n👤 +' + sn + '\n📁 ' + saved.filename });
                            } else if (saved.type === 'videoMessage') {
                                await sock.sendMessage(jid, { video: saved.buffer, caption: '📱 *Status Saved!*\n👤 +' + sn + '\n📁 ' + saved.filename });
                            } else {
                                await sock.sendMessage(jid, { text: '💾 *Saved!*\n📁 ' + saved.filename });
                            }
                        } else {
                            await sock.sendMessage(jid, { text: '❌ *Failed to save status!*' });
                        }
                    } catch (e) {
                        await sock.sendMessage(jid, { text: '❌ *Error!*' });
                    }
                    continue;
                }

                // ============================================================
                // 👁️ VIEW-ONCE SAVE
                // ============================================================
                if (lower === '.vv' || lower === 'vv') {
                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

                    if (!quotedMsg) {
                        await sock.sendMessage(jid, { text: '💡 *Reply to a view-once message* with *vv* to save it\n📸 Photo or video that says "view once"' });
                        continue;
                    }

                    // Check if it's a view-once message
                    const msgType = Object.keys(quotedMsg)[0];
                    const isViewOnce = msgType?.includes('viewOnce') || msgType?.includes('view_once');

                    if (!isViewOnce) {
                        await sock.sendMessage(jid, { text: '❌ *Not a view-once message!*\n💡 Reply to a photo/video that says "view once"' });
                        continue;
                    }

                    try {
                        // Extract inner message from view-once wrapper
                        let realMsg = quotedMsg;
                        if (msgType.includes('viewOnce') || msgType.includes('view_once')) {
                            const innerMsg = quotedMsg[msgType]?.message;
                            if (innerMsg) realMsg = innerMsg;
                        }

                        // Create fake message object
                        const fakeMsg = {
                            key: {
                                remoteJid: jid,
                                id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'vv_' + Date.now()
                            },
                            message: realMsg
                        };

                        const saved = await saveMediaToFile(fakeMsg, VV_FOLDER);

                        if (saved) {
                            // Send saved file back
                            if (saved.type === 'imageMessage') {
                                await sock.sendMessage(jid, {
                                    image: saved.buffer,
                                    caption: '✅ *View-Once Saved!*\n📁 ' + saved.filename
                                });
                            } else if (saved.type === 'videoMessage') {
                                await sock.sendMessage(jid, {
                                    video: saved.buffer,
                                    caption: '✅ *View-Once Saved!*\n📁 ' + saved.filename
                                });
                            } else if (saved.type === 'audioMessage') {
                                await sock.sendMessage(jid, {
                                    audio: saved.buffer,
                                    mimetype: 'audio/ogg',
                                    ptt: true
                                });
                                await sock.sendMessage(jid, { text: '✅ *View-Once Saved!*\n📁 ' + saved.filename });
                            } else {
                                await sock.sendMessage(jid, {
                                    document: saved.buffer,
                                    fileName: saved.filename,
                                    mimetype: 'application/octet-stream'
                                });
                                await sock.sendMessage(jid, { text: '✅ *View-Once Saved!*\n📁 ' + saved.filename });
                            }
                            console.log('✅ VV saved: ' + saved.filename);
                        } else {
                            await sock.sendMessage(jid, { text: '❌ *Failed to save!*\nThe view-once media may have already expired.' });
                        }
                    } catch (e) {
                        console.error('❌ VV error:', e.message);
                        await sock.sendMessage(jid, { text: '❌ *Error saving view-once!*\n' + e.message });
                    }
                    continue;
                }

                // ============================================================
                // 👥 GROUP COMMANDS
                // ============================================================
                if (isGroup) {
                    if (lower === '.admins' || lower === 'admins') {
                        try {
                            const m = await sock.groupMetadata(jid);
                            const ad = m.participants.filter(p => p.admin);
                            await sock.sendMessage(jid, {
                                text: '👑 *Admins*\n\n' + ad.map(p => '@' + p.id.split('@')[0]).join('\n'),
                                mentions: ad.map(p => p.id)
                            });
                        } catch (e) {}
                        continue;
                    }
                    if (lower === '.groupinfo' || lower === 'groupinfo' || lower === '.gcinfo') {
                        try {
                            const m = await sock.groupMetadata(jid);
                            await sock.sendMessage(jid, { text: '📋 *' + m.subject + '*\n👥 ' + m.participants.length + ' members' });
                        } catch (e) {}
                        continue;
                    }
                    if (lower === '.tagall' || lower === 'tagall' || lower === '.everyone') {
                        try {
                            const m = await sock.groupMetadata(jid);
                            await sock.sendMessage(jid, { text: '📢 *Everyone!*', mentions: m.participants.map(p => p.id) });
                        } catch (e) {}
                        continue;
                    }
                    if (lower.startsWith('.poll ') || lower.startsWith('poll ')) {
                        const q = text.replace('.poll', '').replace('poll', '').trim();
                        await sock.sendMessage(jid, { poll: { name: '📊 ' + q, values: ['👍 Yes', '👎 No', '🤔 Maybe'], selectableCount: 1 } });
                        continue;
                    }
                    if (lower.startsWith('.afk') || lower.startsWith('afk ')) {
                        const r = text.replace('.afk', '').replace('afk', '').trim() || 'AFK';
                        await db.afkSet(sender, r);
                        await sock.sendMessage(jid, { text: '💤 @' + sender.split('@')[0] + ' *AFK:* ' + r, mentions: [sender] });
                        continue;
                    }

                    // Admin commands
                    if (isAdmin || isUserOwner) {
                        if (lower === '.mute' || lower === 'mute') {
                            await db.groupSet(jid, 'isMuted', true);
                            await sock.sendMessage(jid, { text: '🔇 *Muted 30min*' });
                            setTimeout(async () => { await db.groupSet(jid, 'isMuted', false); }, 1800000);
                            continue;
                        }
                        if (lower === '.unmute' || lower === 'unmute') { await db.groupSet(jid, 'isMuted', false); await sock.sendMessage(jid, { text: '🔊 *Unmuted!*' }); continue; }
                        if (lower.startsWith('.warn ') || lower.startsWith('warn ')) {
                            const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                            if (men?.length) {
                                const c = await db.warnAdd(men[0], jid);
                                await sock.sendMessage(jid, { text: '⚠️ @' + men[0].split('@')[0] + ' *Warn ' + c + '/3*', mentions: [men[0]] });
                                if (c >= 3) {
                                    try { await sock.groupParticipantsUpdate(jid, [men[0]], 'remove'); await db.warnClear(men[0], jid); } catch (e) {}
                                }
                            }
                            continue;
                        }
                        if (lower.startsWith('.kick ') || lower.startsWith('kick ')) {
                            const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                            if (men?.length) {
                                try { await sock.groupParticipantsUpdate(jid, [men[0]], 'remove'); await sock.sendMessage(jid, { text: '🚫 *Kicked!*' }); } catch (e) {}
                            }
                            continue;
                        }
                        if (lower.startsWith('.add ') || lower.startsWith('add ')) {
                            const num = text.replace('.add', '').replace('add', '').trim().replace(/[^0-9]/g, '');
                            if (num) {
                                try { await sock.groupParticipantsUpdate(jid, [num + '@s.whatsapp.net'], 'add'); await sock.sendMessage(jid, { text: '✅ *Added!*' }); } catch (e) {}
                            }
                            continue;
                        }
                        if (lower.startsWith('.promote ') || lower.startsWith('promote ')) {
                            const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                            if (men?.length) {
                                try { await sock.groupParticipantsUpdate(jid, [men[0]], 'promote'); await sock.sendMessage(jid, { text: '👑 *Promoted!*' }); } catch (e) {}
                            }
                            continue;
                        }
                        if (lower.startsWith('.demote ') || lower.startsWith('demote ')) {
                            const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                            if (men?.length) {
                                try { await sock.groupParticipantsUpdate(jid, [men[0]], 'demote'); await sock.sendMessage(jid, { text: '⬇️ *Demoted!*' }); } catch (e) {}
                            }
                            continue;
                        }
                        if (lower === '.welcome on') { await db.set('welcomeEnabled', true); await sock.sendMessage(jid, { text: '✅ *Welcome ON*' }); continue; }
                        if (lower === '.welcome off') { await db.set('welcomeEnabled', false); await sock.sendMessage(jid, { text: '❌ *Welcome OFF*' }); continue; }
                        if (lower === '.goodbye on') { await db.set('goodbyeEnabled', true); await sock.sendMessage(jid, { text: '✅ *Goodbye ON*' }); continue; }
                        if (lower === '.goodbye off') { await db.set('goodbyeEnabled', false); await sock.sendMessage(jid, { text: '❌ *Goodbye OFF*' }); continue; }
                        if (lower === '.antilink on') { await db.set('antiLinkEnabled', true); await sock.sendMessage(jid, { text: '🔗 *Anti-Link ON*' }); continue; }
                        if (lower === '.antilink off') { await db.set('antiLinkEnabled', false); await sock.sendMessage(jid, { text: '🔗 *Anti-Link OFF*' }); continue; }
                    }
                }

                // ============================================================
                // 👑 OWNER COMMANDS
                // ============================================================
                if (isUserOwner) {
                    if (lower === '.mode' || lower.startsWith('.mode ') || lower === 'mode' || lower.startsWith('mode ')) {
                        const ma = text.replace('.mode', '').replace('mode', '').trim().toLowerCase();
                        const vm = ['private', 'inbox', 'groups', 'public'];
                        const me = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };
                        if (vm.includes(ma)) {
                            await db.set('botMode', ma);
                            await sock.sendMessage(jid, { text: me[ma] + ' *Mode: ' + ma.toUpperCase() + '*' });
                        } else {
                            const cm = await db.get('botMode', 'public');
                            await sock.sendMessage(jid, { text: me[cm] + ' *Current: ' + cm.toUpperCase() + '*\n💡 mode public' });
                        }
                        continue;
                    }
                    if (lower === '.autonews on') { await db.set('autoNewsEnabled', true); await sock.sendMessage(jid, { text: '📰 *Auto News: ON*' }); continue; }
                    if (lower === '.autonews off') { await db.set('autoNewsEnabled', false); await sock.sendMessage(jid, { text: '📰 *Auto News: OFF*' }); continue; }
                    if (lower === '.autostatus on') { await db.set('autoStatusView', true); await db.set('autoStatusReact', true); await sock.sendMessage(jid, { text: '🖤 *Auto Status: ON*' }); continue; }
                    if (lower === '.autostatus off') { await db.set('autoStatusView', false); await db.set('autoStatusReact', false); await db.set('autoStatusSave', false); await sock.sendMessage(jid, { text: '🖤 *Auto Status: OFF*' }); continue; }
                    if (lower.startsWith('.ban ') || lower.startsWith('ban ')) {
                        const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (men?.length) { await db.banAdd(men[0]); await sock.sendMessage(jid, { text: '🚫 @' + men[0].split('@')[0] + ' *banned!*', mentions: [men[0]] }); }
                        continue;
                    }
                    if (lower.startsWith('.unban ') || lower.startsWith('unban ')) {
                        const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (men?.length) { await db.banRemove(men[0]); await sock.sendMessage(jid, { text: '✅ @' + men[0].split('@')[0] + ' *unbanned!*', mentions: [men[0]] }); }
                        continue;
                    }
                    if (lower === '.banlist' || lower === 'banlist') {
                        const bl = await db.banAll();
                        if (!bl.length) await sock.sendMessage(jid, { text: '✅ *No bans!*' });
                        else {
                            const list = bl.map((b, i) => (i + 1) + '. @' + b.userId.split('@')[0]).join('\n');
                            await sock.sendMessage(jid, { text: '🚫 *Banned (' + bl.length + ')*\n' + list, mentions: bl.map(b => b.userId) });
                        }
                        continue;
                    }
                    if (lower.startsWith('.broadcast ') || lower.startsWith('broadcast ')) {
                        const bm = text.replace('.broadcast', '').replace('broadcast', '').trim();
                        try {
                            const gs = await sock.groupFetchAllParticipating();
                            let c = 0;
                            for (const gid of Object.keys(gs)) {
                                try { await sock.sendMessage(gid, { text: '📢 *Broadcast*\n\n' + bm }); c++; await new Promise(r => setTimeout(r, 1000)); } catch (e) {}
                            }
                            await sock.sendMessage(jid, { text: '📢 *Sent to ' + c + ' groups!*' });
                        } catch (e) {}
                        continue;
                    }
                }

                // Anti-Link
                if (isGroup && await db.get('antiLinkEnabled', false) && !isAdmin && !isUserOwner) {
                    if (/https?:\/\/(?:chat\.whatsapp\.com|t\.me|discord\.gg)/i.test(text)) {
                        try { await sock.sendMessage(jid, { delete: msg.key }); } catch (e) {}
                        await sock.sendMessage(jid, { text: '🔗 *Link Deleted!*' });
                        continue;
                    }
                }

                // AFK Detection
                if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                    for (const m of msg.message.extendedTextMessage.contextInfo.mentionedJid) {
                        const a = await db.afkGet(m);
                        if (a) {
                            const mins = Math.floor((Date.now() - new Date(a.afkAt).getTime()) / 60000);
                            await sock.sendMessage(jid, { text: '💤 @' + m.split('@')[0] + ' *AFK:* ' + a.reason + ' (' + mins + 'm)', mentions: [m] });
                        }
                    }
                }
                if (await db.afkGet(sender) && !lower.startsWith('afk') && !lower.startsWith('.afk')) {
                    await db.afkRemove(sender);
                }

            } catch (e) {}
        }
    });

    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (action === 'add' && await db.get('welcomeEnabled', false)) {
            for (const p of participants) await sock.sendMessage(id, { text: '🎉 *Welcome!*\n👋 @' + p.split('@')[0], mentions: [p] });
        }
        if (action === 'remove' && await db.get('goodbyeEnabled', false)) {
            for (const p of participants) await sock.sendMessage(id, { text: '😢 *Goodbye!*\n👋 @' + p.split('@')[0], mentions: [p] });
        }
    });

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) { console.log('\n📱 Scan QR:\n'); qrcode.generate(qr, { small: true }); }
        if (connection === 'close') {
            isConnected = false; sock = null;
            const sc = lastDisconnect?.error?.output?.statusCode;
            if (sc !== DisconnectReason.loggedOut && !isShuttingDown) {
                reconnectAttempts++;
                const d = Math.min(10000, 2000 * reconnectAttempts);
                reconnectTimer = setTimeout(async () => { reconnectTimer = null; if (!isShuttingDown) await startBot(); }, d);
            }
        } else if (connection === 'open') {
            isConnected = true; reconnectAttempts = 0;
            if (sock.user) ownerJid = sock.user.id.replace(/:.*/, '') + '@s.whatsapp.net';
            console.log('\n💝 Connected! 👑 Owners: ' + OWNER_NUMBERS.join(', ') + '\n');
            if (ownerJid) await sendConnectedMessage();
            if (await db.get('autoNewsEnabled', true)) await checkAndShareAllNewNews();
        }
    });
    sock.ev.on('creds.update', saveCreds);
}

// ============================================================
// 🚀 STARTUP
// ============================================================
(async () => {
    console.log('\n💝 NewsBot LK v' + (config.version || '9.0.1') + ' 💝');
    console.log('👨‍💻 ' + (config.developer || 'Charuka Mahesh'));
    console.log('👑 Config Owners: ' + OWNER_NUMBERS.join(', '));
    await connectDatabase();
    await db.set('botMode', 'public');
    await db.set('autoStatusSave', false);
    console.log('🌍 Public Mode\n');
    await startBot();
    setInterval(async () => { if (await db.get('autoNewsEnabled', true)) await checkAndShareAllNewNews(); }, CHECK_INTERVAL_MS);
    console.log('🦄💝 Bot Running! 💝🦄\n');
})();
