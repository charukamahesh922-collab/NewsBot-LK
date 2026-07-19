// ============================================
// 📰 NewsBot LK v8.0.7 - Final Stable
// 👨‍💻 Developed by Charuka Mahesh
// 💛 Dedicated to Umesha Sathyanjali | Mithila | Sharada
// 🌐 https://charukamahesh922-collab.github.io/protifilo/
// 📧 charukamahesh922@gmail.com
// 🐙 https://github.com/charukamahesh922-collab
// ============================================

const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const mongoose = require('mongoose');
const Hiru = require('hirunews-scrap');
const Derana = require('ada-derana-news-scraper');
const DY_NEWS = require('@dark-yasiya/news-scrap');
const config = require('./config');
const voiceClips = require('./voiceReplies');
const dynews = new DY_NEWS();

try { if (fs.existsSync(path.join(__dirname, 'app.pid'))) fs.unlinkSync(path.join(__dirname, 'app.pid')); } catch (e) {}

// ============================================
// CONFIGURATION
// ============================================
const OWNER_NUMBERS = Array.isArray(config.ownerNumber) ? config.ownerNumber : [config.ownerNumber];
const NEWS_GROUP_JID = config.newsGroupJid;
const CHECK_INTERVAL_MS = config.checkIntervalMs;
const BOT_LOGO = config.botLogo;
const FALLBACK_IMAGE = config.fallbackImage;
const REACTIONS = config.reactions;
const SAVE_FOLDER = path.join(__dirname, 'saved_media');
const STATUS_FOLDER = path.join(__dirname, 'saved_status');
const VV_FOLDER = path.join(__dirname, 'view_once_saved');
const TEST_MODE = true;

[SAVE_FOLDER, STATUS_FOLDER, VV_FOLDER].forEach(f => {
    if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true });
});

// ============================================
// JSON FALLBACK DATABASE
// ============================================
const JSON_DB_FILE = path.join(__dirname, 'database.json');
let useJsonFallback = false;
let jsonDb = { settings: {}, warnings: {}, bans: [], afk: {}, groupSettings: {}, sentUrls: [] };

function loadJsonDb() {
    try {
        if (fs.existsSync(JSON_DB_FILE)) {
            const data = JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8'));
            jsonDb = { settings: {}, warnings: {}, bans: [], afk: {}, groupSettings: {}, sentUrls: [], ...data };
        }
    } catch (e) {}
}

function saveJsonDb() {
    try { fs.writeFileSync(JSON_DB_FILE, JSON.stringify(jsonDb, null, 2)); } catch (e) {}
}

// ============================================
// MONGOOSE MODELS
// ============================================
const settingSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const warningSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    groupId: { type: String, required: true },
    count: { type: Number, default: 1 },
    updatedAt: { type: Date, default: Date.now }
}).index({ userId: 1, groupId: 1 });

const banSchema = new mongoose.Schema({
    userId: { type: String, unique: true, required: true },
    reason: { type: String, default: '' },
    bannedAt: { type: Date, default: Date.now }
});

const afkSchema = new mongoose.Schema({
    userId: { type: String, unique: true, required: true },
    reason: { type: String, default: 'AFK' },
    afkAt: { type: Date, default: Date.now }
});

const groupSettingSchema = new mongoose.Schema({
    groupId: { type: String, unique: true, required: true },
    isMuted: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false });

let Setting, Warning, Ban, Afk, GroupSetting;

// ============================================
// DATABASE CONNECTION
// ============================================
async function connectDatabase() {
    if (process.env.MONGO_ENABLED === 'false') {
        useJsonFallback = true;
        loadJsonDb();
        console.log('🗄️ Using JSON file database');
        return false;
    }

    const urls = [{ url: config.mongoInternal }, { url: config.mongoPublic }];
    for (const { url } of urls) {
        try {
            await mongoose.connect(url, {
                dbName: config.dbName,
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                ssl: false, tls: false,
                retryWrites: false
            });

            Setting = mongoose.model('Setting', settingSchema);
            Warning = mongoose.model('Warning', warningSchema);
            Ban = mongoose.model('Ban', banSchema);
            Afk = mongoose.model('Afk', afkSchema);
            GroupSetting = mongoose.model('GroupSetting', groupSettingSchema);

            const count = await Setting.countDocuments();
            if (count === 0) {
                for (const [key, value] of Object.entries(config.defaults)) {
                    await Setting.create({ key, value });
                }
                console.log('📝 Default settings migrated to MongoDB');
            }

            console.log('✅ Mongoose Connected');
            return true;
        } catch (e) {
            if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
        }
    }

    useJsonFallback = true;
    loadJsonDb();
    console.log('🗄️ Using JSON fallback');
    return false;
}

// ============================================
// DATABASE FUNCTIONS
// ============================================
const db = {
    get: async (key, def) => {
        if (useJsonFallback) return jsonDb.settings[key] ?? config.defaults[key] ?? def;
        try { const d = await Setting.findOne({ key }); return d ? d.value : (config.defaults[key] ?? def); } catch { return config.defaults[key] ?? def; }
    },
    set: async (key, val) => {
        if (useJsonFallback) { jsonDb.settings[key] = val; saveJsonDb(); return true; }
        try { await Setting.updateOne({ key }, { $set: { key, value: val, updatedAt: new Date() } }, { upsert: true }); return true; } catch { return false; }
    },
    all: async () => {
        if (useJsonFallback) return { ...config.defaults, ...jsonDb.settings };
        try { const docs = await Setting.find({}); const s = {}; docs.forEach(d => { s[d.key] = d.value; }); return { ...config.defaults, ...s }; } catch { return { ...config.defaults }; }
    },
    warnAdd: async (uid, gid) => {
        if (useJsonFallback) { const k = `${uid}_${gid}`; jsonDb.warnings[k] = (jsonDb.warnings[k] || 0) + 1; saveJsonDb(); return jsonDb.warnings[k]; }
        try { const r = await Warning.findOneAndUpdate({ userId: uid, groupId: gid }, { $inc: { count: 1 }, updatedAt: new Date() }, { upsert: true, new: true }); return r?.count || 0; } catch { return 0; }
    },
    warnClear: async (uid, gid) => {
        if (useJsonFallback) { delete jsonDb.warnings[`${uid}_${gid}`]; saveJsonDb(); return true; }
        try { await Warning.deleteMany({ userId: uid, groupId: gid }); return true; } catch { return false; }
    },
    banAdd: async (uid, reason = '') => {
        if (useJsonFallback) { if (!jsonDb.bans.find(b => b.userId === uid)) { jsonDb.bans.push({ userId: uid, reason, bannedAt: new Date().toISOString() }); saveJsonDb(); } return true; }
        try { await Ban.updateOne({ userId: uid }, { $set: { userId: uid, reason, bannedAt: new Date() } }, { upsert: true }); return true; } catch { return false; }
    },
    banRemove: async (uid) => {
        if (useJsonFallback) { jsonDb.bans = jsonDb.bans.filter(b => b.userId !== uid); saveJsonDb(); return true; }
        try { await Ban.deleteOne({ userId: uid }); return true; } catch { return false; }
    },
    banCheck: async (uid) => {
        if (useJsonFallback) return jsonDb.bans.some(b => b.userId === uid);
        try { return !!(await Ban.findOne({ userId: uid })); } catch { return false; }
    },
    banAll: async () => {
        if (useJsonFallback) return jsonDb.bans;
        try { return await Ban.find({}); } catch { return []; }
    },
    afkSet: async (uid, reason) => {
        if (useJsonFallback) { jsonDb.afk[uid] = { userId: uid, reason, afkAt: new Date().toISOString() }; saveJsonDb(); return true; }
        try { await Afk.updateOne({ userId: uid }, { $set: { userId: uid, reason, afkAt: new Date() } }, { upsert: true }); return true; } catch { return false; }
    },
    afkRemove: async (uid) => {
        if (useJsonFallback) { delete jsonDb.afk[uid]; saveJsonDb(); return true; }
        try { await Afk.deleteOne({ userId: uid }); return true; } catch { return false; }
    },
    afkGet: async (uid) => {
        if (useJsonFallback) return jsonDb.afk[uid] || null;
        try { return await Afk.findOne({ userId: uid }); } catch { return null; }
    },
    groupGet: async (gid, key, def) => {
        if (useJsonFallback) return jsonDb.groupSettings[gid]?.[key] ?? def;
        try { const d = await GroupSetting.findOne({ groupId: gid }); return d?.[key] ?? def; } catch { return def; }
    },
    groupSet: async (gid, key, val) => {
        if (useJsonFallback) { if (!jsonDb.groupSettings[gid]) jsonDb.groupSettings[gid] = {}; jsonDb.groupSettings[gid][key] = val; saveJsonDb(); return true; }
        try { await GroupSetting.updateOne({ groupId: gid }, { $set: { [key]: val, updatedAt: new Date() } }, { upsert: true }); return true; } catch { return false; }
    },
    urlsGet: async () => {
        if (useJsonFallback) return jsonDb.sentUrls || [];
        try { const d = await Setting.findOne({ key: 'sentUrls' }); return d?.value || []; } catch { return []; }
    },
    urlsAdd: async (url) => {
        if (useJsonFallback) { if (!jsonDb.sentUrls.includes(url)) { jsonDb.sentUrls.push(url); saveJsonDb(); } return true; }
        try { await Setting.updateOne({ key: 'sentUrls' }, { $addToSet: { value: url } }, { upsert: true }); return true; } catch { return false; }
    },
    urlsCount: async () => {
        if (useJsonFallback) return jsonDb.sentUrls.length;
        try { const d = await Setting.findOne({ key: 'sentUrls' }); return d?.value?.length || 0; } catch { return 0; }
    }
};

// ============================================
// HELPERS
// ============================================
const footer = () => `\n${'━'.repeat(25)}\n⚡ *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴄʜᴀʀᴜᴋᴀ ᴍᴀʜᴇsʜ*`;

const cleanText = (t) => {
    if (!t) return '';
    return t.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&zwj;/gi, '').replace(/&zwnj;/gi, '').replace(/\s+/g, ' ').trim();
};

const truncate = (t, max = 5000) => {
    if (!t || t.length <= max) return t;
    const s = t.substring(0, max);
    const cuts = [s.lastIndexOf('. '), s.lastIndexOf('? '), s.lastIndexOf('! '), s.lastIndexOf('\n')].filter(p => p > max * 0.6);
    if (cuts.length) return s.substring(0, Math.max(...cuts) + 1).trim();
    const ls = s.lastIndexOf(' ');
    return ls > max * 0.7 ? s.substring(0, ls).trim() + '...' : s.trim() + '...';
};

const randEmoji = () => REACTIONS[Math.floor(Math.random() * REACTIONS.length)];

// ============================================
// BOT STATE
// ============================================
let sock = null, reconnectTimer = null, reconnectAttempts = 0;
let isConnected = false, isShuttingDown = false, lastStatusTime = 0;
let ownerJid = null;

function isOwner(senderNum, sender) {
    const c = senderNum.replace(/[^0-9]/g, '');
    if (OWNER_NUMBERS.some(n => n.replace(/[^0-9]/g, '') === c)) return true;
    if (ownerJid && sender === ownerJid) return true;
    if (ownerJid && ownerJid.split('@')[0].replace(/[^0-9]/g, '') === c) return true;
    return false;
}

async function canUseBot(jid, owner) {
    if (owner) return true;
    const mode = await db.get('botMode', 'public');
    const isGroup = jid.endsWith('@g.us');
    switch (mode) {
        case 'private': return false;
        case 'inbox': return !isGroup;
        case 'groups': return isGroup;
        default: return true;
    }
}

// ============================================
// MEDIA (Status save only, NO auto forward)
// ============================================
async function downloadMedia(msg) {
    try {
        const b = await import('@whiskeysockets/baileys');
        return await b.downloadMediaMessage(msg, 'buffer', {}, { logger: { info: () => {}, error: () => {}, warn: () => {} } });
    } catch { return null; }
}

async function saveMediaToFile(msg, folder = SAVE_FOLDER) {
    try {
        let rm = msg; let type = Object.keys(msg.message || {})[0];
        if (type?.includes('viewOnce')) { const inner = msg.message[type]?.message; if (inner) { rm = { ...msg, message: inner }; type = Object.keys(inner)[0]; } }
        const em = { imageMessage: '.jpg', videoMessage: '.mp4', audioMessage: '.ogg', stickerMessage: '.webp' };
        const ext = em[type]; if (!ext) return null;
        const buf = await downloadMedia(rm); if (!buf || buf.length < 100) return null;
        const fn = `media_${Date.now()}${ext}`; fs.writeFileSync(path.join(folder, fn), buf);
        return { buffer: buf, type, ext, filename: fn };
    } catch { return null; }
}

// ============================================
// STATUS HANDLER (Auto View + Auto React - NO Auto Forward)
// ============================================
async function handleStatus(msg) {
    if (!sock) return;

    try {
        const { key } = msg;
        if (key.fromMe) return;

        const participant = key.participant || key.remoteJid;
        if (!participant || participant === sock.user?.id) return;

        // Rate limit
        if (Date.now() - lastStatusTime < 3000) return;
        lastStatusTime = Date.now();

        const senderNumber = participant.split('@')[0].replace(/:.*/, '');

        // Get settings
        const autoView = await db.get('autoStatusView', true);
        const autoReact = await db.get('autoStatusReact', true);
        const antiViewOnce = await db.get('antiViewOnce', false);

        // Skip view-once if anti-vv is on
        if (antiViewOnce) {
            const isViewOnce = msg.message?.imageMessage?.viewOnce || msg.message?.videoMessage?.viewOnce;
            if (isViewOnce) {
                console.log(`🚫 Skipped view-once status: ${senderNumber}`);
                return;
            }
        }

        // Auto View
        if (autoView) {
            await sock.readMessages([key]);
            console.log(`👁️ Status viewed: ${senderNumber}`);
        } else {
            return;
        }

        // Auto React
        if (autoReact) {
            const emoji = config.statusEmojis[Math.floor(Math.random() * config.statusEmojis.length)];
            try {
                await sock.sendMessage('status@broadcast', { react: { text: emoji, key } });
                console.log(`  💬 Reacted: ${emoji}`);
            } catch (e) {
                console.log(`  ⚠️ React failed: ${e.message}`);
            }
        }

        // NOTE: Status is NOT auto-forwarded to owner
        // Use .vv command to save view-once media
        // Use .save command to save any media

    } catch (err) {
        console.error('Status handler error:', err.message);
    }
}

async function checkAdmin(jid, sender) {
    try { const m = await sock.groupMetadata(jid); const p = m.participants.find(p => p.id === sender); return p?.admin != null; } catch { return false; }
}

// ============================================
// MAIN BOT
// ============================================
async function startBot() {
    if (sock) { try { sock.end(); } catch {} sock = null; }
    const baileys = await import('@whiskeysockets/baileys');
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));
    sock = makeWASocket({ auth: state, browser: [config.botName, 'Chrome', config.version], connectTimeoutMs: 30000, printQRInTerminal: false });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            const jid = msg.key.remoteJid;
            if (jid === 'status@broadcast') { await handleStatus(msg); continue; }
            if (msg.key.fromMe && !TEST_MODE) continue;

            let rawText = '';
            if (msg.message.conversation) rawText = msg.message.conversation;
            else if (msg.message.extendedTextMessage?.text) rawText = msg.message.extendedTextMessage.text;
            else if (msg.message.imageMessage?.caption) rawText = msg.message.imageMessage.caption;
            else if (msg.message.videoMessage?.caption) rawText = msg.message.videoMessage.caption;
            if (!rawText) continue;

            const text = rawText.trim(), lower = text.toLowerCase();
            const sender = msg.key.participant || jid;
            const senderNum = sender.split('@')[0].replace(/[^0-9]/g, '');
            const owner = isOwner(senderNum, sender);
            const group = jid.endsWith('@g.us');
            const admin = group ? await checkAdmin(jid, sender) : false;
            const prefix = await db.get('prefix', '.');
            const canToggle = owner || (group && admin);

            // MODE CHECK
            if (!await canUseBot(jid, owner)) {
                if (lower.startsWith(prefix) || lower.startsWith('.')) {
                    const mode = await db.get('botMode', 'public');
                    await sock.sendMessage(jid, { text: `🔒 *Bot is in ${mode.toUpperCase()} Mode*\n\n❌ You cannot use commands here\n👑 Only owner has full access${footer()}` });
                }
                return;
            }

            if (await db.banCheck(sender) && !owner) return;

            // ============================================
            // 🎵 VOICE TOGGLE
            // ============================================
            if (lower === '.voice on' || lower === `${prefix}voice on`) {
                if (owner || (group && admin)) {
                    await db.set('voiceReplyEnabled', true);
                    await sock.sendMessage(jid, { text: '🎵 *Voice Replies: ON* ✅\n\n📝 Send gm/gn in DM for voice' + footer() });
                } else { await sock.sendMessage(jid, { text: '❌ *Only admins/owner!*' + footer() }); }
                return;
            }
            if (lower === '.voice off' || lower === `${prefix}voice off`) {
                if (owner || (group && admin)) {
                    await db.set('voiceReplyEnabled', false);
                    await sock.sendMessage(jid, { text: '🎵 *Voice Replies: OFF* ❌' + footer() });
                } else { await sock.sendMessage(jid, { text: '❌ *Only admins/owner!*' + footer() }); }
                return;
            }

            // ============================================
            // 🎵 AUTO VOICE REPLIES (DM Only)
            // ============================================
            if (!group && await db.get('voiceReplyEnabled', true) && voiceClips?.replies) {
                for (const [trigger, audioUrl] of Object.entries(voiceClips.replies)) {
                    const words = lower.split(/\s+/);
                    if (lower === trigger || words.includes(trigger) || (trigger.includes(' ') && lower.includes(trigger))) {
                        try {
                            const res = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 20000 });
                            const buf = Buffer.from(res.data);
                            if (buf.length > 100) {
                                const sent = await sock.sendMessage(jid, { audio: buf, mimetype: 'audio/mpeg', ptt: true }, { quoted: msg });
                                await sock.sendMessage(jid, { react: { text: '🎵', key: sent.key } });
                            }
                        } catch (e) {
                            if (trigger.includes('morning') || trigger === 'gm') await sock.sendMessage(jid, { text: '🌅 *Good Morning!* ☀️' + footer() }, { quoted: msg });
                            else if (trigger.includes('night') || trigger === 'gn') await sock.sendMessage(jid, { text: '🌙 *Good Night!* 😴' + footer() }, { quoted: msg });
                        }
                        return;
                    }
                }
            }

            // ============================================
            // 📥 VIEW-ONCE SAVER (.vv)
            // ============================================
            if (lower === '.vv' || lower === `${prefix}vv` || lower === 'vv') {
                const ctx = msg.message?.extendedTextMessage?.contextInfo;
                if (ctx?.quotedMessage) {
                    const qm = ctx.quotedMessage;
                    if (qm.imageMessage?.viewOnce || qm.videoMessage?.viewOnce) {
                        await sock.sendMessage(jid, { text: '🔄 *Downloading view-once...*' });
                        const fm = { key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant }, message: qm };
                        const saved = await saveMediaToFile(fm, VV_FOLDER);
                        if (saved && ownerJid) {
                            const cap = `📱 *View-Once Saved!*\n👤 @${sender.split('@')[0]}\n📅 ${new Date().toLocaleString()}${footer()}`;
                            try { if (saved.type === 'imageMessage') await sock.sendMessage(ownerJid, { image: saved.buffer, caption: cap, mentions: [sender] }); else if (saved.type === 'videoMessage') await sock.sendMessage(ownerJid, { video: saved.buffer, caption: cap, mentions: [sender] }); } catch (e) {}
                            await sock.sendMessage(jid, { text: '✅ *Saved to inbox!* 📥' + footer() });
                        } else { await sock.sendMessage(jid, { text: '❌ *Failed!*' + footer() }); }
                    } else { await sock.sendMessage(jid, { text: '⚠️ *Not a view-once message!*' + footer() }); }
                } else { await sock.sendMessage(jid, { text: '💡 Reply to view-once with *.vv*' + footer() }); }
                return;
            }

            // ============================================
            // 📋 MENU
            // ============================================
            if (lower === '.menu' || lower === '.help' || lower === `${prefix}menu` || lower === `${prefix}help` || lower === 'menu' || lower === 'help') {
                const m = [
                    `╭${'─'.repeat(24)}╮`, `┃   📰 *${config.botName}*`, `┃   ✨ ${config.tagline}`, `╰${'─'.repeat(24)}╯`,
                    '', `📡 *📰 NEWS*`, `▸ ${prefix}news  •  ${prefix}stats`,
                    '', `📦 *💾 MEDIA*`, `▸ ${prefix}save  •  ${prefix}status  •  ${prefix}vv`,
                    '', `👥 *GROUP*`, `▸ ${prefix}admins  •  ${prefix}groupinfo`, `▸ ${prefix}tagall  •  ${prefix}poll  •  ${prefix}afk`,
                ];
                if (admin || owner) m.push('', `🛡️ *ADMIN*`, `▸ ${prefix}mute  •  ${prefix}unmute  •  ${prefix}warn`, `▸ ${prefix}kick  •  ${prefix}add  •  ${prefix}promote`, `▸ ${prefix}demote  •  ${prefix}voice  •  ${prefix}antilink`, `▸ ${prefix}welcome  •  ${prefix}goodbye`);
                if (owner) m.push('', `👑 *OWNER*`, `▸ ${prefix}settings  •  ${prefix}mode  •  ${prefix}autostatus`, `▸ ${prefix}autonews  •  ${prefix}setprefix`, `▸ ${prefix}broadcast  •  ${prefix}ban  •  ${prefix}unban`);
                m.push('', `${'━'.repeat(25)}`, `🌐 ${config.portfolio}`, `👨‍💻 ${config.developer}`, `⚡ Powered by Charuka Mahesh`);
                const sent = await sock.sendMessage(jid, { image: { url: BOT_LOGO }, caption: m.join('\n'), mimetype: 'image/png' });
                await sock.sendMessage(jid, { react: { text: '📋', key: sent.key } });
                return;
            }

            // ============================================
            // ⚙️ SETTINGS (Owner ONLY - Works ANYWHERE)
            // ============================================
            if (lower === '.settings' || lower === '.setting' || lower === `${prefix}settings` || lower === `${prefix}setting` || lower === 'settings' || lower === 'setting') {
                if (!owner) { await sock.sendMessage(jid, { text: '❌ *Only owner can access settings!*' + footer() }); return; }
                const s = await db.all(); const bans = await db.banAll();
                const me = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };
                const msg = [
                    `╭${'─'.repeat(24)}╮`, `┃   ⚙️ *Bot Settings*`, `┃   📰 ${config.botName}`, `╰${'─'.repeat(24)}╯`,
                    '', `📰 *NEWS*`, `▸ Auto News: ${s.autoNewsEnabled === true ? '✅' : '❌'}  → .autonews on/off`,
                    '', `🖤 *STATUS (View + React only)*`, `▸ Auto View: ${s.autoStatusView === true ? '✅' : '❌'}  → .autostatus on/off`, `▸ Auto React: ${s.autoStatusReact === true ? '✅' : '❌'}  → .autostatus on/off`,
                    '', `🔒 *PROTECTION*`, `▸ Anti-Link: ${s.antiLinkEnabled === true ? '✅' : '❌'}  → .antilink on/off`, `▸ Anti VV: ${s.antiViewOnce === true ? '✅' : '❌'}  → .antiview on/off`,
                    '', `🎵 *VOICE*`, `▸ Voice Replies: ${s.voiceReplyEnabled === true ? '✅' : '❌'}  → .voice on/off`,
                    '', `👥 *GROUP*`, `▸ Welcome: ${s.welcomeEnabled === true ? '✅' : '❌'}  → .welcome on/off`, `▸ Goodbye: ${s.goodbyeEnabled === true ? '✅' : '❌'}  → .goodbye on/off`,
                    '', `🔧 *SYSTEM*`, `▸ Prefix: "${s.prefix || '.'}"  → .setprefix`, `▸ Mode: ${me[s.botMode] || '🌍'} ${(s.botMode || 'public').toUpperCase()}  → .mode`, `▸ Banned: ${bans.length}`, `▸ v${config.version}`,
                    '', `${'━'.repeat(25)}`, `🌐 ${config.portfolio}`, `👨‍💻 ${config.developer}`, `⚡ Powered by Charuka Mahesh`,
                ].join('\n');
                const sent = await sock.sendMessage(jid, { image: { url: BOT_LOGO }, caption: msg, mimetype: 'image/png' });
                await sock.sendMessage(jid, { react: { text: '⚙️', key: sent.key } });
                return;
            }

            // ============================================
            // 👑 MODE (Owner only - anywhere)
            // ============================================
            if (owner && (lower === '.mode' || lower.startsWith('.mode ') || lower === `${prefix}mode` || lower.startsWith(`${prefix}mode `))) {
                const arg = text.replace('.mode', '').replace(`${prefix}mode`, '').trim().toLowerCase();
                const modes = ['private', 'inbox', 'groups', 'public'];
                if (modes.includes(arg)) {
                    await db.set('botMode', arg);
                    const me = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };
                    const md = { private: 'Only Owner', inbox: 'Anyone in DM', groups: 'Anyone in groups', public: 'Anyone anywhere' };
                    await sock.sendMessage(jid, { text: `${me[arg]} *Mode: ${arg.toUpperCase()}*\n\n📝 ${md[arg]}\n👑 Owner always has full access${footer()}` });
                } else {
                    const cm = await db.get('botMode', 'public');
                    const me = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };
                    await sock.sendMessage(jid, { text: `${me[cm]} *Mode: ${cm.toUpperCase()}*\n\n💡 .mode private/inbox/groups/public${footer()}` });
                }
                return;
            }

            // ============================================
            // TOGGLES - Owner ANYWHERE, Admin GROUPS only
            // ============================================
            if (canToggle) {
                if (lower === '.antilink on' || lower === `${prefix}antilink on`) { await db.set('antiLinkEnabled', true); await sock.sendMessage(jid, { text: '🔗 *Anti-Link: ON* ✅' + footer() }); return; }
                if (lower === '.antilink off' || lower === `${prefix}antilink off`) { await db.set('antiLinkEnabled', false); await sock.sendMessage(jid, { text: '🔗 *Anti-Link: OFF* ❌' + footer() }); return; }
                if (lower === '.antiview on' || lower === `${prefix}antiview on`) { await db.set('antiViewOnce', true); await sock.sendMessage(jid, { text: '🚫 *Anti View-Once: ON*' + footer() }); return; }
                if (lower === '.antiview off' || lower === `${prefix}antiview off`) { await db.set('antiViewOnce', false); await sock.sendMessage(jid, { text: '👁️ *Anti View-Once: OFF*' + footer() }); return; }
                if (lower === '.welcome on' || lower === `${prefix}welcome on`) { await db.set('welcomeEnabled', true); await sock.sendMessage(jid, { text: '👋 *Welcome: ON* ✅' + footer() }); return; }
                if (lower === '.welcome off' || lower === `${prefix}welcome off`) { await db.set('welcomeEnabled', false); await sock.sendMessage(jid, { text: '👋 *Welcome: OFF* ❌' + footer() }); return; }
                if (lower === '.goodbye on' || lower === `${prefix}goodbye on`) { await db.set('goodbyeEnabled', true); await sock.sendMessage(jid, { text: '👋 *Goodbye: ON* ✅' + footer() }); return; }
                if (lower === '.goodbye off' || lower === `${prefix}goodbye off`) { await db.set('goodbyeEnabled', false); await sock.sendMessage(jid, { text: '👋 *Goodbye: OFF* ❌' + footer() }); return; }
            }

            // ============================================
            // GROUP ADMIN COMMANDS (Groups ONLY)
            // ============================================
            if (group && (admin || owner)) {
                if (lower === '.mute' || lower === `${prefix}mute`) { await db.groupSet(jid, 'isMuted', true); await sock.sendMessage(jid, { text: '🔇 *Muted 30min*' + footer() }); setTimeout(() => db.groupSet(jid, 'isMuted', false), 30 * 60 * 1000); return; }
                if (lower === '.unmute' || lower === `${prefix}unmute`) { await db.groupSet(jid, 'isMuted', false); await sock.sendMessage(jid, { text: '🔊 *Unmuted!*' + footer() }); return; }
                if (lower.startsWith('.warn ') || lower.startsWith(`${prefix}warn `)) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { const c = await db.warnAdd(m[0], jid); await sock.sendMessage(jid, { text: `⚠️ @${m[0].split('@')[0]} (*${c}/3*)`, mentions: [m[0]] }); if (c >= 3) { try { await sock.groupParticipantsUpdate(jid, [m[0]], 'remove'); await db.warnClear(m[0], jid); } catch {} } } return; }
                if (lower.startsWith('.kick ') || lower.startsWith(`${prefix}kick `)) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { try { await sock.groupParticipantsUpdate(jid, [m[0]], 'remove'); } catch {} } return; }
                if (lower.startsWith('.add ') || lower.startsWith(`${prefix}add `)) { const n = text.replace('.add', '').replace(`${prefix}add`, '').trim().replace(/[^0-9]/g, ''); if (n) { try { await sock.groupParticipantsUpdate(jid, [`${n}@s.whatsapp.net`], 'add'); } catch {} } return; }
                if (lower.startsWith('.promote ') || lower.startsWith(`${prefix}promote `)) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { try { await sock.groupParticipantsUpdate(jid, [m[0]], 'promote'); } catch {} } return; }
                if (lower.startsWith('.demote ') || lower.startsWith(`${prefix}demote `)) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { try { await sock.groupParticipantsUpdate(jid, [m[0]], 'demote'); } catch {} } return; }
            }

            // ============================================
            // 👑 OWNER COMMANDS (Works ANYWHERE)
            // ============================================
            if (owner) {
                if (lower === '.autostatus on' || lower === `${prefix}autostatus on`) { await db.set('autoStatusView', true); await db.set('autoStatusReact', true); await sock.sendMessage(jid, { text: '🖤 *Auto Status: ON* ✅\n\n👁️ View: ON\n💬 React: ON\n📵 Forward: OFF' + footer() }); return; }
                if (lower === '.autostatus off' || lower === `${prefix}autostatus off`) { await db.set('autoStatusView', false); await db.set('autoStatusReact', false); await sock.sendMessage(jid, { text: '🖤 *Auto Status: OFF* ❌' + footer() }); return; }
                if (lower === '.autonews on' || lower === `${prefix}autonews on`) { await db.set('autoNewsEnabled', true); await sock.sendMessage(jid, { text: '📰 *Auto News: ON* ✅' + footer() }); return; }
                if (lower === '.autonews off' || lower === `${prefix}autonews off`) { await db.set('autoNewsEnabled', false); await sock.sendMessage(jid, { text: '📰 *Auto News: OFF* ❌' + footer() }); return; }
                if (lower.startsWith('.setprefix ') || lower.startsWith(`${prefix}setprefix `)) { const p = text.replace('.setprefix', '').replace(`${prefix}setprefix`, '').trim(); if (p.length >= 1 && p.length <= 3) { await db.set('prefix', p); await sock.sendMessage(jid, { text: `🔧 *Prefix: "${p}"*\nUse *${p}menu*` + footer() }); } return; }
                if (lower.startsWith('.broadcast ') || lower.startsWith(`${prefix}broadcast `)) { const msg2 = text.replace('.broadcast', '').replace(`${prefix}broadcast`, '').trim(); try { const gs = await sock.groupFetchAllParticipating(); let c = 0; for (const gid of Object.keys(gs)) { try { await sock.sendMessage(gid, { text: `📢 *Broadcast*\n\n${msg2}${footer()}` }); c++; await new Promise(r => setTimeout(r, 1000)); } catch {} } await sock.sendMessage(jid, { text: `📢 Sent to *${c}* groups!` + footer() }); } catch {} return; }
                if (lower.startsWith('.ban ') || lower.startsWith(`${prefix}ban `)) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { await db.banAdd(m[0]); await sock.sendMessage(jid, { text: `🚫 @${m[0].split('@')[0]} *banned!*`, mentions: [m[0]] }); } return; }
                if (lower.startsWith('.unban ') || lower.startsWith(`${prefix}unban `)) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { await db.banRemove(m[0]); await sock.sendMessage(jid, { text: `✅ @${m[0].split('@')[0]} *unbanned!*`, mentions: [m[0]] }); } return; }
                if (lower === '.banlist' || lower === `${prefix}banlist`) { const bans = await db.banAll(); if (!bans.length) await sock.sendMessage(jid, { text: '✅ *No bans!*' + footer() }); else await sock.sendMessage(jid, { text: `🚫 *${bans.length} Banned*\n${bans.map((b, i) => `${i + 1}. @${b.userId.split('@')[0]}`).join('\n')}`, mentions: bans.map(b => b.userId) }); return; }
                if (lower.startsWith('.clearwarns ') || lower.startsWith(`${prefix}clearwarns `)) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { await db.warnClear(m[0], jid); await sock.sendMessage(jid, { text: `✅ Cleared!`, mentions: [m[0]] }); } return; }
            }

            // ============================================
            // 👥 GROUP COMMANDS
            // ============================================
            if (group) {
                if (lower === '.admins' || lower === `${prefix}admins`) { try { const m = await sock.groupMetadata(jid); const ad = m.participants.filter(p => p.admin); const s = await sock.sendMessage(jid, { text: `👑 *Admins*\n${ad.map(p => `@${p.id.split('@')[0]}`).join('\n')}`, mentions: ad.map(p => p.id) }); await sock.sendMessage(jid, { react: { text: '👑', key: s.key } }); } catch {} return; }
                if (lower === '.groupinfo' || lower === `${prefix}groupinfo` || lower === '.gcinfo') { try { const m = await sock.groupMetadata(jid); const s = await sock.sendMessage(jid, { text: `📋 *${m.subject}*\n👥 ${m.participants.length} members\n👑 @${m.owner?.split('@')[0]}`, mentions: [m.owner] }); await sock.sendMessage(jid, { react: { text: '📋', key: s.key } }); } catch {} return; }
                if (lower === '.tagall' || lower === `${prefix}tagall` || lower === '.everyone') { try { const m = await sock.groupMetadata(jid); const s = await sock.sendMessage(jid, { text: '📢 *Everyone!*', mentions: m.participants.map(p => p.id) }); await sock.sendMessage(jid, { react: { text: '📢', key: s.key } }); } catch {} return; }
                if (lower.startsWith('.poll ') || lower.startsWith(`${prefix}poll `)) { const s = await sock.sendMessage(jid, { poll: { name: `📊 ${text.replace('.poll', '').replace(`${prefix}poll`, '').trim()}`, values: ['👍 Yes', '👎 No', '🤔 Maybe'], selectableCount: 1 } }); await sock.sendMessage(jid, { react: { text: '📊', key: s.key } }); return; }
                if (lower.startsWith('.afk') || lower.startsWith(`${prefix}afk`)) { const r = text.replace('.afk', '').replace(`${prefix}afk`, '').trim() || 'AFK'; await db.afkSet(sender, r); const s = await sock.sendMessage(jid, { text: `💤 @${sender.split('@')[0]} *AFK:* ${r}`, mentions: [sender] }); await sock.sendMessage(jid, { react: { text: '💤', key: s.key } }); return; }
            }

            // ============================================
            // 📰 NEWS
            // ============================================
            if (lower === '.news' || lower === `${prefix}news` || lower === 'news') {
                if (!await db.get('autoNewsEnabled', true) && !owner) { await sock.sendMessage(jid, { text: '❌ *News disabled!*' + footer() }); return; }
                await sock.sendMessage(jid, { text: '📰 *Fetching news...*\n📡 Sent to news group' + footer() });
                await checkAndShareAllNewNews();
                return;
            }

            // ============================================
            // 📊 STATS
            // ============================================
            if (lower === '.stats' || lower === `${prefix}stats` || lower === 'stats') {
                const s = await db.all(); const c = await db.urlsCount();
                const txt = `📊 *Stats*\n\n📰 News: *${c}*\n📱 Statuses: *${fs.readdirSync(STATUS_FOLDER).length}*\n💾 Media: *${fs.readdirSync(SAVE_FOLDER).length}*\n🔄 Interval: *${CHECK_INTERVAL_MS / 1000}s*\n\n📰 News: ${s.autoNewsEnabled === true ? '✅' : '❌'}\n🖤 Status: ${s.autoStatusView === true ? '✅' : '❌'}\n🔗 AntiLink: ${s.antiLinkEnabled === true ? '✅' : '❌'}\n🎵 Voice: ${s.voiceReplyEnabled === true ? '✅' : '❌'}\n🔧 Prefix: "${s.prefix || '.'}"${footer()}`;
                const sent = await sock.sendMessage(jid, { text: txt }); await sock.sendMessage(jid, { react: { text: '📊', key: sent.key } });
                return;
            }

            // ============================================
            // 📱 STATUS INFO
            // ============================================
            if (lower === '.status' || lower === `${prefix}status` || lower === '.vs') {
                const s = await db.all();
                const txt = `📱 *Status Saver*\n\n👁️ Auto View: ${s.autoStatusView === true ? '✅' : '❌'}\n💬 Auto React: ${s.autoStatusReact === true ? '✅' : '❌'}\n📵 Auto Forward: DISABLED\n🚫 Anti VV: ${s.antiViewOnce === true ? '✅' : '❌'}\n📂 Saved: *${fs.readdirSync(STATUS_FOLDER).length}* files\n\n💡 Use .vv for view-once\n💡 Use .save for media${footer()}`;
                const sent = await sock.sendMessage(jid, { text: txt }); await sock.sendMessage(jid, { react: { text: '📱', key: sent.key } });
                return;
            }

            // ============================================
            // 💾 SAVE MEDIA
            // ============================================
            if (lower === '.save' || lower === `${prefix}save` || lower === '.ss') {
                const ctx = msg.message?.extendedTextMessage?.contextInfo;
                if (ctx?.quotedMessage) {
                    const fm = { key: { remoteJid: jid, id: ctx.stanzaId }, message: ctx.quotedMessage };
                    const sv = await saveMediaToFile(fm);
                    if (sv) {
                        if (sv.type === 'imageMessage') await sock.sendMessage(jid, { image: sv.buffer, caption: '💾 *Saved!*' + footer() });
                        else if (sv.type === 'videoMessage') await sock.sendMessage(jid, { video: sv.buffer, caption: '💾 *Saved!*' + footer() });
                        else if (sv.type === 'stickerMessage') await sock.sendMessage(jid, { sticker: sv.buffer });
                        else await sock.sendMessage(jid, { document: sv.buffer, fileName: sv.filename, caption: '💾 *Saved!*' + footer() });
                    } else await sock.sendMessage(jid, { text: '❌ *Failed!*' + footer() });
                } else await sock.sendMessage(jid, { text: '💡 Reply to media with *.save*' + footer() });
                return;
            }

            // Anti-link
            if (group && await db.get('antiLinkEnabled', false) && /https?:\/\/(?:chat\.whatsapp\.com|t\.me|discord\.gg)/i.test(text) && !admin && !owner) {
                try { await sock.sendMessage(jid, { delete: msg.key }); } catch {}
                await sock.sendMessage(jid, { text: `🔗 *Link deleted!*`, mentions: [sender] });
                return;
            }

            // AFK
            if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                for (const m of msg.message.extendedTextMessage.contextInfo.mentionedJid) {
                    const afk = await db.afkGet(m);
                    if (afk) { const mins = Math.floor((Date.now() - new Date(afk.afkAt).getTime()) / 60000); await sock.sendMessage(jid, { text: `💤 @${m.split('@')[0]} *AFK:* ${afk.reason} (${mins}m)`, mentions: [m] }); }
                }
            }
            if (await db.afkGet(sender) && !lower.startsWith('.afk') && !lower.startsWith(`${prefix}afk`)) await db.afkRemove(sender);
        }
    });

    // Group events
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (action === 'add' && await db.get('welcomeEnabled', false)) { const wm = await db.get('welcomeMessage', '👋 Welcome @user! 🎉'); for (const p of participants) await sock.sendMessage(id, { text: `🎉 *Welcome!*\n\n${wm.replace('@user', `@${p.split('@')[0]}`)}${footer()}`, mentions: [p] }); }
        if (action === 'remove' && await db.get('goodbyeEnabled', false)) { const gm = await db.get('goodbyeMessage', '👋 Goodbye @user! 😢'); for (const p of participants) await sock.sendMessage(id, { text: `👋 *Goodbye!*\n\n${gm.replace('@user', `@${p.split('@')[0]}`)}${footer()}`, mentions: [p] }); }
    });

    // Connection
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) { console.log('📱 QR:'); qrcode.generate(qr, { small: true }); }
        if (connection === 'close') { isConnected = false; sock = null; const code = lastDisconnect?.error?.output?.statusCode; if (code !== DisconnectReason.loggedOut && !isShuttingDown) { reconnectAttempts++; reconnectTimer = setTimeout(async () => { reconnectTimer = null; await startBot(); }, Math.min(30000, 5000 * reconnectAttempts)); } }
        else if (connection === 'open') { isConnected = true; reconnectAttempts = 0; if (sock.user) ownerJid = sock.user.id.replace(/:.*/, '') + '@s.whatsapp.net'; console.log(`\n✅ Connected!\n👑 ${ownerJid}\n🗄️ ${useJsonFallback ? 'JSON' : 'Mongoose'}\n`); if (ownerJid) { try { await sock.sendMessage(ownerJid, { image: { url: BOT_LOGO }, caption: `✅ *${config.botName} v${config.version}*\n\n🗄️ ${useJsonFallback ? 'JSON' : 'Mongoose'}\n👑 Owner Mode\n\n🖤 Auto View: ON\n💬 Auto React: ON\n📵 Auto Forward: OFF\n\n.settings - Settings\n.mode - Bot Mode\n.menu - Commands${footer()}`, mimetype: 'image/png' }); } catch {} } if (await db.get('autoNewsEnabled', true)) await checkAndShareAllNewNews(); }
    });
    sock.ev.on('creds.update', saveCreds);
}

// ============================================
// NEWS FUNCTIONS
// ============================================
async function scrapeArticle(url) { try { const { data: html } = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!html) return { description: '', image: '' }; let img = ''; const og = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i); if (og?.[1]) img = og[1]; const ch = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, ''); let d = ''; for (const rx of [/<div[^>]*class="[^"]*news-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i, /<article[^>]*>([\s\S]*?)<\/article>/i]) { const m = ch.match(rx); if (m?.[1]) { const ps = m[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi); if (ps) { d = ps.map(p => p.replace(/<[^>]*>/g, '').trim()).filter(p => p.length > 30).join('\n\n'); if (d.length > 200) break; } } } if (!d) { const ps = ch.match(/<p[^>]*>([\s\S]*?)<\/p>/gi); if (ps) d = ps.map(p => p.replace(/<[^>]*>/g, '').trim()).filter(p => p.length > 30 && !p.includes('googletag') && !p.includes('window.') && !p.includes('function(')).join('\n\n'); } return { description: cleanText(d || ''), image: img }; } catch { return { description: '', image: '' }; } }
async function fetchHiruNews() { const a = new Hiru(); const cats = ['BreakingNews','MainNews','TrendingNews']; const n = []; const s = new Set(); for (const c of cats) { if (typeof a[c] !== 'function') continue; try { const i = await a[c](); const u = i?.results?.newsURL, t = i?.results?.title; if (u && !s.has(u) && t) { s.add(u); n.push({ source:'🇱🇰 Hiru', category:c.replace('News',''), title:t, description:cleanText(i.results.news||''), url:u, image:i.results.thumb||'', date:i.results.date||'' }); } } catch {} } return n; }
async function fetchDeranaNews() { const n = []; try { const r = await Derana.scrapeHotNews(); if (Array.isArray(r)) { for (const a of r.slice(0,3)) { const u = a.url||'', t = a.title||''; if (u&&t) { const { description, image } = await scrapeArticle(u); let d = description; if (!d||d.length<100) { d = a.content||a.description||t; d = String(d).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(); } n.push({ source:'🔴 Derana', category:'Hot', title:t, description:d, url:u, image:image||FALLBACK_IMAGE, date:a.time||'' }); await new Promise(r=>setTimeout(r,500)); } } } } catch {} return n; }
async function fetchRSS(url, source, limit = 3) { const n = []; try { const { data } = await axios.get(url,{timeout:10000,headers:{'User-Agent':'Mozilla/5.0'}}); const items = data.match(/<item>([\s\S]*?)<\/item>/gi)||[]; for (const i of items.slice(0,limit)) { const t = (i.match(/<title>([^<]+)<\/title>/i)||[])[1]?.trim()||''; const u = (i.match(/<link>([^<]+)<\/link>/i)||[])[1]?.trim()||''; const img = (i.match(/<media:content[^>]*url="([^"]*)"/i)||[])[1]?.trim()||''; if (t&&u) { const { description } = await scrapeArticle(u); n.push({ source, category:'Latest', title:t, description:description||t, url:u, image:img||FALLBACK_IMAGE, date:'' }); await new Promise(r=>setTimeout(r,500)); } } } catch {} return n; }
async function fetchAllLatestNews() { const src = [{ n:'Hiru', f:fetchHiruNews },{ n:'Derana', f:fetchDeranaNews },{ n:'AdaDerana', f:()=>fetchRSS('https://www.adaderana.lk/rss.php','📰 AdaDerana') },{ n:'Cricket', f:()=>fetchRSS('https://www.espncricinfo.com/rss/content/story/feeds/8.xml','🏏 ESPN',2) },{ n:'Ada.lk', f:async()=>{ try{ const r=await dynews.ada(); if(r?.status&&r.result?.url){ const d=cleanText(r.result.desc||''); if(d.length>50)return[{source:'📰 Ada.lk',category:'Latest',title:r.result.title,description:d,url:r.result.url,image:r.result.image||FALLBACK_IMAGE,date:`${r.result.date} ${r.result.time}`}]; } }catch{} return[]; } },{ n:'Newswire', f:async()=>{ try{ const r=await dynews.newswire(); if(r?.status&&r.result?.url){ const d=cleanText(r.result.desc||''); if(d.length>50)return[{source:'📰 Newswire',category:'Latest',title:r.result.title,description:d,url:r.result.url,image:r.result.image||FALLBACK_IMAGE,date:`${r.result.date} ${r.result.time}`}]; } }catch{} return[]; } },{ n:'Sirasa', f:async()=>{ try{ const r=await dynews.sirasa(); if(r?.status&&r.result?.url){ const d=cleanText(r.result.desc||''); if(d.length>50)return[{source:'📺 Sirasa',category:'Latest',title:r.result.title,description:d,url:r.result.url,image:r.result.image||FALLBACK_IMAGE,date:`${r.result.date} ${r.result.time}`}]; } }catch{} return[]; } }]; const res = await Promise.allSettled(src.map(s=>s.f())); const all = []; src.forEach((s,i)=>{ if(res[i].status==='fulfilled'&&Array.isArray(res[i].value)&&res[i].value.length){ all.push(...res[i].value); } }); const uniq = []; const seen = new Set(); for (const x of all) { if (x.url&&!seen.has(x.url)) { seen.add(x.url); uniq.push(x); } } return uniq; }
async function sendNews(jid, n) { if (!sock?.user) return false; const d = truncate((n.description||n.title||'').trim(), 5000); const cap = `📰 *${n.source}* | ${n.category}\n\n📌 *${n.title}*\n\n${d}\n\n${n.date?`📅 ${n.date}\n`:''}🔗 ${n.url}${footer()}`; try { let s; if (n.image?.length>10) { try { s = await sock.sendMessage(jid,{image:{url:n.image},caption:cap,mimetype:'image/jpeg'}); } catch {} } if (!s) s = await sock.sendMessage(jid,{image:{url:BOT_LOGO},caption:cap,mimetype:'image/png'}); await sock.sendMessage(jid,{react:{text:randEmoji(),key:s.key}}); return true; } catch { return false; } }
async function checkAndShareAllNewNews() { if (!sock?.user||await db.groupGet(NEWS_GROUP_JID,'isMuted',false)) return; try { const all = await fetchAllLatestNews(); if (!all.length) return; const urls = await db.urlsGet(); if (!urls.length) { for (const i of all) { if (i.url) await db.urlsAdd(i.url); } return; } let s=0; for (const i of all) { if (!i.url||urls.includes(i.url)) continue; if (await sendNews(NEWS_GROUP_JID,i)) { await db.urlsAdd(i.url); s++; } await new Promise(r=>setTimeout(r,3000)); } } catch {} }

// ============================================
// 🚀 START
// ============================================
(async () => {
    console.log(`\n╔${'═'.repeat(40)}╗`);
    console.log(`║      📰 ${config.botName} v${config.version} 📰          ║`);
    console.log(`║   Auto View ✅ | Auto React ✅ | Forward ❌  ║`);
    console.log(`╚${'═'.repeat(40)}╝`);
    console.log(`👨‍💻 ${config.developer}`);
    console.log(`👑 Owners: ${OWNER_NUMBERS.join(', ')}`);
    console.log(`📡 News Group: ${NEWS_GROUP_JID}\n`);
    await connectDatabase();
    await startBot();
    setInterval(async () => { if (await db.get('autoNewsEnabled', true)) await checkAndShareAllNewNews(); }, CHECK_INTERVAL_MS);
})();
