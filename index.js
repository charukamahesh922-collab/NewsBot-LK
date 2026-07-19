// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🦄 Beautiful Edition 🦄                    ║
// ║              Developed by Charuka Mahesh                     ║
// ║     Dedicated to Umesha Sathyanjali | Mithila | Sharada     ║
// ║                  Version: 9.0.0 ✨                           ║
// ╚══════════════════════════════════════════════════════════════╝

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

// ============================================================
// 🧹 CLEANUP
// ============================================================
try { if (fs.existsSync(path.join(__dirname, 'app.pid'))) fs.unlinkSync(path.join(__dirname, 'app.pid')); } catch (e) {}
console.log('🧹 Cleanup complete');

// ============================================================
// ⚙️ CONFIGURATION
// ============================================================
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

[SAVE_FOLDER, STATUS_FOLDER, VV_FOLDER].forEach(f => { if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true }); });

// ============================================================
// 🗄️ JSON DATABASE
// ============================================================
const JSON_DB_FILE = path.join(__dirname, 'database.json');
let useJsonFallback = false;
let jsonDb = { settings: {}, warnings: {}, bans: [], afk: {}, groupSettings: {}, sentUrls: [] };
function loadJsonDb() { try { if (fs.existsSync(JSON_DB_FILE)) { const d = JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8')); jsonDb = { settings: {}, warnings: {}, bans: [], afk: {}, groupSettings: {}, sentUrls: [], ...d }; } } catch (e) {} }
function saveJsonDb() { try { fs.writeFileSync(JSON_DB_FILE, JSON.stringify(jsonDb, null, 2)); } catch (e) {} }

// ============================================================
// 🍃 MONGOOSE SCHEMAS
// ============================================================
const settingSchema = new mongoose.Schema({ key: { type: String, unique: true, required: true }, value: { type: mongoose.Schema.Types.Mixed, required: true }, updatedAt: { type: Date, default: Date.now } });
const warningSchema = new mongoose.Schema({ userId: { type: String, required: true }, groupId: { type: String, required: true }, count: { type: Number, default: 1 }, updatedAt: { type: Date, default: Date.now } }).index({ userId: 1, groupId: 1 });
const banSchema = new mongoose.Schema({ userId: { type: String, unique: true, required: true }, reason: { type: String, default: '' }, bannedAt: { type: Date, default: Date.now } });
const afkSchema = new mongoose.Schema({ userId: { type: String, unique: true, required: true }, reason: { type: String, default: 'AFK' }, afkAt: { type: Date, default: Date.now } });
const groupSettingSchema = new mongoose.Schema({ groupId: { type: String, unique: true, required: true }, isMuted: { type: Boolean, default: false }, updatedAt: { type: Date, default: Date.now } }, { strict: false });
let Setting, Warning, Ban, Afk, GroupSetting;

// ============================================================
// 🔌 DATABASE CONNECTION
// ============================================================
async function connectDatabase() {
    if (process.env.MONGO_ENABLED === 'false') { useJsonFallback = true; loadJsonDb(); return false; }
    const urls = [{ url: config.mongoInternal }, { url: config.mongoPublic }];
    for (const { url } of urls) {
        try {
            await mongoose.connect(url, { dbName: config.dbName, serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, ssl: false, tls: false, retryWrites: false });
            Setting = mongoose.model('Setting', settingSchema); Warning = mongoose.model('Warning', warningSchema); Ban = mongoose.model('Ban', banSchema); Afk = mongoose.model('Afk', afkSchema); GroupSetting = mongoose.model('GroupSetting', groupSettingSchema);
            if (await Setting.countDocuments() === 0) { for (const [k, v] of Object.entries(config.defaults)) await Setting.create({ key: k, value: v }); }
            console.log('✅ Mongoose Connected'); return true;
        } catch (e) { if (mongoose.connection.readyState !== 0) await mongoose.disconnect(); }
    }
    useJsonFallback = true; loadJsonDb(); return false;
}

// ============================================================
// 🗃️ DATABASE OPERATIONS
// ============================================================
const db = {
    isJson: () => useJsonFallback,
    get: async (k, d) => { if (useJsonFallback) return jsonDb.settings[k] ?? config.defaults[k] ?? d; try { const r = await Setting.findOne({ key: k }); return r ? r.value : (config.defaults[k] ?? d); } catch { return config.defaults[k] ?? d; } },
    set: async (k, v) => { if (useJsonFallback) { jsonDb.settings[k] = v; saveJsonDb(); return true; } try { await Setting.updateOne({ key: k }, { $set: { key: k, value: v, updatedAt: new Date() } }, { upsert: true }); return true; } catch { return false; } },
    all: async () => { if (useJsonFallback) return { ...config.defaults, ...jsonDb.settings }; try { const docs = await Setting.find({}); const s = {}; docs.forEach(d => { s[d.key] = d.value; }); return { ...config.defaults, ...s }; } catch { return { ...config.defaults }; } },
    warnAdd: async (u, g) => { if (useJsonFallback) { const k = `${u}_${g}`; jsonDb.warnings[k] = (jsonDb.warnings[k] || 0) + 1; saveJsonDb(); return jsonDb.warnings[k]; } try { const r = await Warning.findOneAndUpdate({ userId: u, groupId: g }, { $inc: { count: 1 } }, { upsert: true, new: true }); return r?.count || 0; } catch { return 0; } },
    warnClear: async (u, g) => { if (useJsonFallback) { delete jsonDb.warnings[`${u}_${g}`]; saveJsonDb(); return true; } try { await Warning.deleteMany({ userId: u, groupId: g }); return true; } catch { return false; } },
    banAdd: async (u, r = '') => { if (useJsonFallback) { if (!jsonDb.bans.find(b => b.userId === u)) { jsonDb.bans.push({ userId: u, reason: r, bannedAt: new Date().toISOString() }); saveJsonDb(); } return true; } try { await Ban.updateOne({ userId: u }, { $set: { userId: u, reason: r, bannedAt: new Date() } }, { upsert: true }); return true; } catch { return false; } },
    banRemove: async (u) => { if (useJsonFallback) { jsonDb.bans = jsonDb.bans.filter(b => b.userId !== u); saveJsonDb(); return true; } try { await Ban.deleteOne({ userId: u }); return true; } catch { return false; } },
    banCheck: async (u) => { if (useJsonFallback) return jsonDb.bans.some(b => b.userId === u); try { return !!(await Ban.findOne({ userId: u })); } catch { return false; } },
    banAll: async () => { if (useJsonFallback) return jsonDb.bans; try { return await Ban.find({}); } catch { return []; } },
    afkSet: async (u, r) => { if (useJsonFallback) { jsonDb.afk[u] = { userId: u, reason: r, afkAt: new Date().toISOString() }; saveJsonDb(); return true; } try { await Afk.updateOne({ userId: u }, { $set: { userId: u, reason: r, afkAt: new Date() } }, { upsert: true }); return true; } catch { return false; } },
    afkRemove: async (u) => { if (useJsonFallback) { delete jsonDb.afk[u]; saveJsonDb(); return true; } try { await Afk.deleteOne({ userId: u }); return true; } catch { return false; } },
    afkGet: async (u) => { if (useJsonFallback) return jsonDb.afk[u] || null; try { return await Afk.findOne({ userId: u }); } catch { return null; } },
    groupGet: async (g, k, d) => { if (useJsonFallback) return jsonDb.groupSettings[g]?.[k] ?? d; try { const r = await GroupSetting.findOne({ groupId: g }); return r?.[k] ?? d; } catch { return d; } },
    groupSet: async (g, k, v) => { if (useJsonFallback) { if (!jsonDb.groupSettings[g]) jsonDb.groupSettings[g] = {}; jsonDb.groupSettings[g][k] = v; saveJsonDb(); return true; } try { await GroupSetting.updateOne({ groupId: g }, { $set: { [k]: v } }, { upsert: true }); return true; } catch { return false; } },
    urlsGet: async () => { if (useJsonFallback) return jsonDb.sentUrls || []; try { const d = await Setting.findOne({ key: 'sentUrls' }); return d?.value || []; } catch { return []; } },
    urlsAdd: async (u) => { if (useJsonFallback) { if (!jsonDb.sentUrls.includes(u)) { jsonDb.sentUrls.push(u); saveJsonDb(); } return true; } try { await Setting.updateOne({ key: 'sentUrls' }, { $addToSet: { value: u } }, { upsert: true }); return true; } catch { return false; } },
    urlsCount: async () => { if (useJsonFallback) return jsonDb.sentUrls.length; try { const d = await Setting.findOne({ key: 'sentUrls' }); return d?.value?.length || 0; } catch { return 0; } }
};

// ============================================================
// 🎨 BEAUTIFUL UI
// ============================================================
const beautifulFooter = () => {
    return [
        '',
        '╭' + '─'.repeat(35) + '╮',
        '┃  🦄💝 *NewsBot LK* 💝🦄  ┃',
        '┃   💝 *Charuka Mahesh* 💝   ┃',
        '╰' + '─'.repeat(35) + '╯',
        '',
        '💝 *Umesha Sathyanjali* 💝',
        '💝 *Mithila & Sharada* 💝'
    ].join('\n');
};

const sectionDivider = (title, emoji) => { const line = '─'.repeat(8); return `\n${emoji} ${line} *${title}* ${line} ${emoji}\n`; };
const statusBadge = (enabled) => enabled ? '✅ *ON*' : '❌ *OFF*';
const cleanText = (t) => { if (!t) return ''; return t.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&zwj;/gi, '').replace(/&zwnj;/gi, '').replace(/\s+/g, ' ').trim(); };
const truncate = (t, m = 5000) => { if (!t || t.length <= m) return t; const s = t.substring(0, m); const c = [s.lastIndexOf('. '), s.lastIndexOf('? '), s.lastIndexOf('! '), s.lastIndexOf('\n')].filter(p => p > m * 0.6); if (c.length) return s.substring(0, Math.max(...c) + 1).trim(); const l = s.lastIndexOf(' '); return l > m * 0.7 ? s.substring(0, l).trim() + '...' : s.trim() + '...'; };
const randEmoji = (a) => a[Math.floor(Math.random() * a.length)];

// ============================================================
// 🔐 AUTH
// ============================================================
let sock = null, reconnectTimer = null, reconnectAttempts = 0;
let isConnected = false, isShuttingDown = false, lastStatusTime = 0;
let ownerJid = null, ownerPhone = null, ownerDeviceId = null, ownerLid = null, cleanOwnerJid = null;

function isOwner(senderNumber, senderJid) {
    const cleanNumber = senderNumber.replace(/[^0-9]/g, '');
    if (OWNER_NUMBERS.some(num => num.replace(/[^0-9]/g, '') === cleanNumber)) return true;
    if (ownerJid) { const oc = ownerJid.replace(/:.*/, '').split('@')[0].replace(/[^0-9]/g, ''); if (cleanNumber === oc) return true; if (senderJid.replace(/:.*/, '') === ownerJid.replace(/:.*/, '')) return true; }
    if (ownerPhone && cleanNumber === ownerPhone.replace(/[^0-9]/g, '')) return true;
    return false;
}

async function canUseBot(jid, owner) { if (owner) return true; const mode = await db.get('botMode', 'public'); const isGroup = jid.endsWith('@g.us'); switch (mode) { case 'private': return false; case 'inbox': return !isGroup; case 'groups': return isGroup; default: return true; } }
async function checkAdmin(jid, sender) { try { const m = await sock.groupMetadata(jid); const p = m.participants.find(p => p.id === sender); return p?.admin != null; } catch { return false; } }

// ============================================================
// 📥 MEDIA
// ============================================================
async function downloadMedia(msg) { try { const b = await import('@whiskeysockets/baileys'); return await b.downloadMediaMessage(msg, 'buffer', {}, { logger: { info: () => {}, error: () => {}, warn: () => {} } }); } catch { return null; } }
async function saveMediaToFile(msg, folder = SAVE_FOLDER) { try { let rm = msg; let t = Object.keys(msg.message || {})[0]; if (t?.includes('viewOnce')) { const inner = msg.message[t]?.message; if (inner) { rm = { ...msg, message: inner }; t = Object.keys(inner)[0]; } } const em = { imageMessage: '.jpg', videoMessage: '.mp4', audioMessage: '.ogg', stickerMessage: '.webp' }; const e = em[t]; if (!e) return null; const b = await downloadMedia(rm); if (!b || b.length < 100) return null; const fn = `media_${Date.now()}${e}`; fs.writeFileSync(path.join(folder, fn), b); return { buffer: b, type: t, ext: e, filename: fn }; } catch { return null; } }
async function updateBotBio() { if (!sock || !isConnected) return; if (!await db.get('autoBioEnabled', true)) return; try { const n = new Date(); const ds = n.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }); const ts = n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); await sock.updateProfileStatus(`💝 ${config.botName} | Auto Mode\n📅 ${ds}\n⏰ ${ts}\n🦄 Powered by Charuka Mahesh`); } catch (e) {} }
async function handleStatus(msg) { if (!sock) return; try { const { key } = msg; if (key.fromMe) return; const p = key.participant || key.remoteJid; if (!p || p === sock.user?.id) return; if (Date.now() - lastStatusTime < 3000) return; lastStatusTime = Date.now(); if (await db.get('antiViewOnce', false) && (msg.message?.imageMessage?.viewOnce || msg.message?.videoMessage?.viewOnce)) return; if (!await db.get('autoStatusView', true)) return; await sock.readMessages([key]); if (await db.get('autoStatusReact', true)) { const em = randEmoji(config.statusEmojis); try { await sock.sendMessage('status@broadcast', { react: { text: em, key } }); } catch (e) {} } } catch (e) {} }

// ============================================================
// 💝 CONNECTED MESSAGE
// ============================================================
async function sendConnectedMessage(retryCount = 0) {
    if (!sock) { if (retryCount < 5) { setTimeout(() => sendConnectedMessage(retryCount + 1), 3000); } return; }
    if (!ownerPhone) { if (retryCount < 5) { setTimeout(() => sendConnectedMessage(retryCount + 1), 3000); } return; }
    const targetJid = ownerPhone + '@s.whatsapp.net';
    const device = ownerDeviceId || 'PRIMARY';
    const lid = ownerLid || 'N/A';
    console.log(`📨 Sending connect message to: ${targetJid}`);
    const captionText = [
        '╔' + '═'.repeat(42) + '╗',
        '║       💝 *NewsBot LK* 💝          ║',
        '║    🦄 ✨ *Successfully* ✨ 🦄      ║',
        '║        *Connected!*               ║',
        '╚' + '═'.repeat(42) + '╝',
        '',
        '┌' + '─'.repeat(40) + '┐',
        '│  ✅ *Status:* Online              │',
        '│  📱 *Phone:* ' + ownerPhone.padEnd(26) + '│',
        '│  🔗 *Device ID:* ' + device.padEnd(22) + '│',
        '│  🆔 *LID:* ' + lid.padEnd(28) + '│',
        '│                                    │',
        '│  📋 *.menu*     ─ Show Menu        │',
        '│  ⚙️ *.settings*  ─ Settings         │',
        '│  📰 *.news*      ─ Fetch News       │',
        '│  📊 *.stats*     ─ Statistics       │',
        '└' + '─'.repeat(40) + '┘',
        '',
        '💡 *Add to config.js:*',
        '   ownerNumber: ["' + ownerPhone + '"]',
        '',
        beautifulFooter()
    ].join('\n');
    try {
        await sock.sendMessage(targetJid, { image: { url: BOT_LOGO }, caption: captionText, mimetype: 'image/png' });
        console.log('✅ Connected message with LOGO sent!');
    } catch (error) {
        console.log(`❌ Attempt ${retryCount + 1} failed: ${error.message}`);
        if (retryCount < 5) { setTimeout(() => sendConnectedMessage(retryCount + 1), (retryCount + 1) * 3000); }
        else { try { await sock.sendMessage(targetJid, { text: captionText }); console.log('✅ Text-only sent!'); } catch (e) {} }
    }
}

// ============================================================
// 💝 MENUS
// ============================================================
async function sendBeautifulMenu(sock, jid, db, config, owner, admin, isGroup, prefix) {
    const mode = await db.get('botMode', 'public');
    const me = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };
    const m = [
        '╭' + '─'.repeat(40) + '╮',
        '┃       💝 *NewsBot LK* 💝       ┃',
        '┃   🦄 ✨ *Sri Lanka\'s #1* ✨ 🦄   ┃',
        '┃     *WhatsApp News Bot*        ┃',
        '┃     ' + me[mode] + ' Mode: ' + mode.toUpperCase() + '              ┃',
        '╰' + '─'.repeat(40) + '╯',
        '',
        sectionDivider('📰 NEWS CENTER', '📡'),
        '  ✦ ' + prefix + 'news       ─ Fetch Latest News',
        '  ✦ ' + prefix + 'stats      ─ Bot Statistics',
        '',
        sectionDivider('💾 MEDIA STUDIO', '📦'),
        '  ✦ ' + prefix + 'save       ─ Save Media Files',
        '  ✦ ' + prefix + 'vv         ─ Save View-Once',
        '  ✦ ' + prefix + 'status     ─ Status Info',
        '',
        sectionDivider('👥 GROUP TOOLS', '👑'),
        '  ✦ ' + prefix + 'admins     ─ List Admins',
        '  ✦ ' + prefix + 'groupinfo  ─ Group Details',
        '  ✦ ' + prefix + 'tagall     ─ Mention All',
        '  ✦ ' + prefix + 'poll       ─ Create Poll',
        '  ✦ ' + prefix + 'afk        ─ Set AFK Status',
        ''
    ];
    if (admin || owner) { m.push(sectionDivider('🛡️ ADMIN PANEL', '⚔️'), '  ✦ ' + prefix + 'mute/unmute    ─ Toggle Mute', '  ✦ ' + prefix + 'warn @user     ─ Warn Member', '  ✦ ' + prefix + 'kick @user     ─ Remove Member', '  ✦ ' + prefix + 'add 94xxxxxxx  ─ Add Member', '  ✦ ' + prefix + 'promote @user  ─ Make Admin', '  ✦ ' + prefix + 'demote @user   ─ Remove Admin', '  ✦ ' + prefix + 'voice on/off   ─ Voice Replies', '  ✦ ' + prefix + 'antilink on/off ─ Link Protection', '  ✦ ' + prefix + 'welcome on/off ─ Welcome Msg', '  ✦ ' + prefix + 'goodbye on/off ─ Goodbye Msg', '  ✦ ' + prefix + 'buttons on/off ─ Button Menu', ''); }
    if (owner) { m.push(sectionDivider('👑 OWNER SUITE', '💎'), '  ✦ ' + prefix + 'settings       ─ All Settings', '  ✦ ' + prefix + 'mode public    ─ Bot Mode', '  ✦ ' + prefix + 'autostatus on/off ─ Auto Status', '  ✦ ' + prefix + 'autonews on/off ─ Auto News', '  ✦ ' + prefix + 'autobio on/off ─ Auto Bio', '  ✦ ' + prefix + 'setprefix !    ─ Change Prefix', '  ✦ ' + prefix + 'broadcast msg  ─ Mass Message', '  ✦ ' + prefix + 'ban @user      ─ Ban User', '  ✦ ' + prefix + 'unban @user    ─ Unban User', '  ✦ ' + prefix + 'banlist        ─ Banned List', ''); }
    m.push(sectionDivider('🎵 VOICE COMMANDS (DM)', '🎤'), '  gm ✦ gn ✦ hi ✦ ily ✦ bye', '  sad ✦ happy ✦ cry ✦ love', '  adarei ✦ kohomada ✦ pakaya', '  ...150+ Sinhala & English!', '', '━'.repeat(40), '🌐 ' + config.portfolio, '👨‍💻 ' + config.developer, '📦 Version: ' + config.version, '🔧 Prefix: "' + prefix + '"', '', beautifulFooter());
    const sent = await sock.sendMessage(jid, { image: { url: BOT_LOGO }, caption: m.join('\n'), mimetype: 'image/png' });
    await sock.sendMessage(jid, { react: { text: '📋', key: sent.key } });
}

async function sendBeautifulSettings(sock, jid, db, isOwner, config) {
    if (!isOwner) { await sock.sendMessage(jid, { text: '╭' + '─'.repeat(30) + '╮\n┃  ❌ *Owner Only!*  ┃\n╰' + '─'.repeat(30) + '╯' + beautifulFooter() }); return; }
    const s = await db.all(); const bans = await db.banAll();
    const me = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };
    const msg = ['╭' + '─'.repeat(38) + '╮', '┃         ⚙️ *Bot Settings*         ┃', '┃         💝 NewsBot LK 💝         ┃', '╰' + '─'.repeat(38) + '╯', '', sectionDivider('📰 NEWS', '📡'), '  ▸ Auto News: ' + statusBadge(s.autoNewsEnabled), '', sectionDivider('🖤 STATUS', '📱'), '  ▸ Auto View: ' + statusBadge(s.autoStatusView), '  ▸ Auto React: ' + statusBadge(s.autoStatusReact), '', sectionDivider('🔒 SECURITY', '🛡️'), '  ▸ Anti-Link: ' + statusBadge(s.antiLinkEnabled), '  ▸ Anti VV: ' + statusBadge(s.antiViewOnce), '', sectionDivider('🎵 VOICE', '🎤'), '  ▸ Voice Replies: ' + statusBadge(s.voiceReplyEnabled), '', sectionDivider('📝 DISPLAY', '✨'), '  ▸ Auto Bio: ' + statusBadge(s.autoBioEnabled), '  ▸ Button Menu: ' + statusBadge(s.buttonMenuEnabled), '', sectionDivider('👥 GROUP', '👑'), '  ▸ Welcome: ' + statusBadge(s.welcomeEnabled), '  ▸ Goodbye: ' + statusBadge(s.goodbyeEnabled), '', sectionDivider('🔧 SYSTEM', '⚙️'), '  ▸ Prefix: "' + (s.prefix || '.') + '"', '  ▸ Mode: ' + me[s.botMode] + ' ' + (s.botMode || 'public').toUpperCase(), '  ▸ Banned: ' + bans.length, '  ▸ Version: v' + config.version, '', beautifulFooter()].join('\n');
    const sent = await sock.sendMessage(jid, { image: { url: BOT_LOGO }, caption: msg, mimetype: 'image/png' });
    await sock.sendMessage(jid, { react: { text: '⚙️', key: sent.key } });
}

// ============================================================
// 🤖 MAIN BOT
// ============================================================
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

            if (lower.startsWith('.') || lower.startsWith(prefix)) console.log(`📩 [${senderNum}] "${lower}"`);
            if (!await canUseBot(jid, owner)) { if (lower.startsWith(prefix) || lower.startsWith('.')) { const mode = await db.get('botMode', 'public'); await sock.sendMessage(jid, { text: '╭' + '─'.repeat(30) + '╮\n┃  🔒 *' + mode.toUpperCase() + ' Mode!*  ┃\n╰' + '─'.repeat(30) + '╯' + beautifulFooter() }); } return; }
            if (await db.banCheck(sender) && !owner) return;

            // Menu
            if (lower === '.menu' || lower === `${prefix}menu` || lower === 'menu') { await sendBeautifulMenu(sock, jid, db, config, owner, admin, group, prefix); return; }
            // Settings
            if (lower === '.settings' || lower === `${prefix}settings` || lower === 'settings') { await sendBeautifulSettings(sock, jid, db, owner, config); return; }
            // Stats
            if (lower === '.stats' || lower === `${prefix}stats` || lower === 'stats') { const s = await db.all(); const c = await db.urlsCount(); const txt = '╭' + '─'.repeat(38) + '╮\n┃         📊 *Statistics*           ┃\n┃         💝 NewsBot LK 💝         ┃\n╰' + '─'.repeat(38) + '╯\n\n' + sectionDivider('📊 OVERVIEW', '📈') + '\n  📰 News: *' + c + '*\n  📱 Status: *' + fs.readdirSync(STATUS_FOLDER).length + '*\n  💾 Media: *' + fs.readdirSync(SAVE_FOLDER).length + '*\n\n' + sectionDivider('⚙️ STATUS', '📋') + '\n  📰 Auto News: ' + statusBadge(s.autoNewsEnabled) + '\n  🖤 React: ' + statusBadge(s.autoStatusReact) + '\n  🎵 Voice: ' + statusBadge(s.voiceReplyEnabled) + '\n\n' + beautifulFooter(); const sent = await sock.sendMessage(jid, { text: txt }); await sock.sendMessage(jid, { react: { text: '📊', key: sent.key } }); return; }
            // News
            if (lower === '.news' || lower === `${prefix}news` || lower === 'news') { if (!await db.get('autoNewsEnabled', true) && !owner) { await sock.sendMessage(jid, { text: '❌ *News Disabled!*' + beautifulFooter() }); return; } await sock.sendMessage(jid, { text: '📰 *Fetching news...*' + beautifulFooter() }); await checkAndShareAllNewNews(); return; }

            // Toggles
            if (canToggle) {
                const toggles = { 'voice on': ['voiceReplyEnabled', true, '🎵 *Voice: ON* ✅'], 'voice off': ['voiceReplyEnabled', false, '🎵 *Voice: OFF* ❌'], 'buttons on': ['buttonMenuEnabled', true, '🔘 *Buttons: ON* ✅'], 'buttons off': ['buttonMenuEnabled', false, '📋 *Text Menu: ON* ✅'], 'antilink on': ['antiLinkEnabled', true, '🔗 *Anti-Link: ON* ✅'], 'antilink off': ['antiLinkEnabled', false, '🔗 *Anti-Link: OFF* ❌'], 'welcome on': ['welcomeEnabled', true, '👋 *Welcome: ON* ✅'], 'welcome off': ['welcomeEnabled', false, '👋 *Welcome: OFF* ❌'], 'goodbye on': ['goodbyeEnabled', true, '👋 *Goodbye: ON* ✅'], 'goodbye off': ['goodbyeEnabled', false, '👋 *Goodbye: OFF* ❌'], 'autobio on': ['autoBioEnabled', true, '📝 *Auto Bio: ON* ✅'], 'autobio off': ['autoBioEnabled', false, '📝 *Auto Bio: OFF* ❌'] };
                for (const [cmd, [key, val, ms]] of Object.entries(toggles)) { if (lower === '.' + cmd || lower === prefix + cmd) { await db.set(key, val); await sock.sendMessage(jid, { text: ms + beautifulFooter() }); return; } }
            }

            // ✅ VOICE REPLIES (DM - Works for EVERYONE including owner)
            if (!group && await db.get('voiceReplyEnabled', true) && voiceClips?.replies) {
                for (const [trigger, url] of Object.entries(voiceClips.replies)) {
                    const words = lower.split(/\s+/);
                    if (lower === trigger || words.includes(trigger) || (trigger.includes(' ') && lower.includes(trigger))) {
                        console.log(`🎵 Voice: "${trigger}" from ${senderNum}`);
                        try {
                            const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
                            const buf = Buffer.from(res.data);
                            if (buf.length > 100) {
                                const s = await sock.sendMessage(jid, { audio: buf, mimetype: 'audio/mpeg', ptt: true }, { quoted: msg });
                                await sock.sendMessage(jid, { react: { text: '🎵', key: s.key } });
                                console.log(`✅ Voice sent: ${trigger}`);
                            }
                        } catch (e) { console.error(`❌ Voice error: ${e.message}`); }
                        return;
                    }
                }
            }

            // Owner Commands
            if (owner) {
                if (lower === '.mode' || lower.startsWith('.mode ')) { const arg = text.replace('.mode', '').trim().toLowerCase(); const modes = ['private', 'inbox', 'groups', 'public']; const me = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' }; if (modes.includes(arg)) { await db.set('botMode', arg); await sock.sendMessage(jid, { text: me[arg] + ' *Mode: ' + arg.toUpperCase() + '*\n\n' + beautifulFooter() }); } else { const cm = await db.get('botMode', 'public'); await sock.sendMessage(jid, { text: me[cm] + ' *Current: ' + cm.toUpperCase() + '*\n💡 .mode private/inbox/groups/public\n\n' + beautifulFooter() }); } return; }
                if (lower === '.autostatus on' || lower === `${prefix}autostatus on`) { await db.set('autoStatusView', true); await db.set('autoStatusReact', true); await sock.sendMessage(jid, { text: '🖤 *Auto Status: ON* ✅' + beautifulFooter() }); return; }
                if (lower === '.autostatus off' || lower === `${prefix}autostatus off`) { await db.set('autoStatusView', false); await db.set('autoStatusReact', false); await sock.sendMessage(jid, { text: '🖤 *Auto Status: OFF* ❌' + beautifulFooter() }); return; }
                if (lower === '.autonews on' || lower === `${prefix}autonews on`) { await db.set('autoNewsEnabled', true); await sock.sendMessage(jid, { text: '📰 *Auto News: ON* ✅' + beautifulFooter() }); return; }
                if (lower === '.autonews off' || lower === `${prefix}autonews off`) { await db.set('autoNewsEnabled', false); await sock.sendMessage(jid, { text: '📰 *Auto News: OFF* ❌' + beautifulFooter() }); return; }
                if (lower.startsWith('.setprefix ')) { const p = text.replace('.setprefix', '').trim(); if (p.length >= 1 && p.length <= 3) { await db.set('prefix', p); await sock.sendMessage(jid, { text: '🔧 *Prefix: "' + p + '"*\n💡 Use *' + p + 'menu*\n\n' + beautifulFooter() }); } return; }
                if (lower.startsWith('.broadcast ')) { const m2 = text.replace('.broadcast', '').trim(); try { const gs = await sock.groupFetchAllParticipating(); let c = 0; for (const gid of Object.keys(gs)) { try { await sock.sendMessage(gid, { text: '📢 *Broadcast*\n\n' + m2 + '\n\n' + beautifulFooter() }); c++; await new Promise(r => setTimeout(r, 1000)); } catch {} } await sock.sendMessage(jid, { text: '📢 Sent to *' + c + '* groups!' + beautifulFooter() }); } catch {} return; }
                if (lower.startsWith('.ban ')) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { await db.banAdd(m[0]); await sock.sendMessage(jid, { text: '🚫 @' + m[0].split('@')[0] + ' *banned!*\n\n' + beautifulFooter(), mentions: [m[0]] }); } return; }
                if (lower.startsWith('.unban ')) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { await db.banRemove(m[0]); await sock.sendMessage(jid, { text: '✅ @' + m[0].split('@')[0] + ' *unbanned!*\n\n' + beautifulFooter(), mentions: [m[0]] }); } return; }
                if (lower === '.banlist' || lower === `${prefix}banlist`) { const bans = await db.banAll(); if (!bans.length) await sock.sendMessage(jid, { text: '✅ *No bans!*' + beautifulFooter() }); else { await sock.sendMessage(jid, { text: '🚫 *Banned (' + bans.length + ')*\n' + bans.map((b, i) => (i + 1) + '. @' + b.userId.split('@')[0]).join('\n') + '\n\n' + beautifulFooter(), mentions: bans.map(b => b.userId) }); } return; }
            }

            // Group Commands
            if (group) {
                if (lower === '.admins' || lower === `${prefix}admins`) { try { const m = await sock.groupMetadata(jid); const ad = m.participants.filter(p => p.admin); const s = await sock.sendMessage(jid, { text: '👑 *Admins*\n' + ad.map(p => '👑 @' + p.id.split('@')[0]).join('\n') + '\n\n' + beautifulFooter(), mentions: ad.map(p => p.id) }); await sock.sendMessage(jid, { react: { text: '👑', key: s.key } }); } catch {} return; }
                if (lower === '.groupinfo' || lower === `${prefix}groupinfo` || lower === '.gcinfo') { try { const m = await sock.groupMetadata(jid); const s = await sock.sendMessage(jid, { text: '📋 *' + m.subject + '*\n👥 ' + m.participants.length + '\n👑 @' + m.owner?.split('@')[0] + '\n\n' + beautifulFooter(), mentions: [m.owner] }); await sock.sendMessage(jid, { react: { text: '📋', key: s.key } }); } catch {} return; }
                if (lower === '.tagall' || lower === `${prefix}tagall` || lower === '.everyone') { try { const m = await sock.groupMetadata(jid); const s = await sock.sendMessage(jid, { text: '📢 *Everyone!*\n\n' + beautifulFooter(), mentions: m.participants.map(p => p.id) }); await sock.sendMessage(jid, { react: { text: '📢', key: s.key } }); } catch {} return; }
                if (lower.startsWith('.poll ')) { const s = await sock.sendMessage(jid, { poll: { name: '📊 ' + text.replace('.poll', '').trim(), values: ['👍 Yes', '👎 No', '🤔 Maybe'], selectableCount: 1 } }); await sock.sendMessage(jid, { react: { text: '📊', key: s.key } }); return; }
                if (lower.startsWith('.afk')) { const r = text.replace('.afk', '').trim() || 'AFK'; await db.afkSet(sender, r); const s = await sock.sendMessage(jid, { text: '💤 @' + sender.split('@')[0] + ' *AFK:* ' + r + '\n\n' + beautifulFooter(), mentions: [sender] }); await sock.sendMessage(jid, { react: { text: '💤', key: s.key } }); return; }

                if (admin || owner) {
                    if (lower === '.mute' || lower === `${prefix}mute`) { await db.groupSet(jid, 'isMuted', true); await sock.sendMessage(jid, { text: '🔇 *Muted 30min*\n\n' + beautifulFooter() }); setTimeout(() => db.groupSet(jid, 'isMuted', false), 30 * 60 * 1000); return; }
                    if (lower === '.unmute' || lower === `${prefix}unmute`) { await db.groupSet(jid, 'isMuted', false); await sock.sendMessage(jid, { text: '🔊 *Unmuted!*\n\n' + beautifulFooter() }); return; }
                    if (lower.startsWith('.warn ')) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { const c = await db.warnAdd(m[0], jid); await sock.sendMessage(jid, { text: '⚠️ @' + m[0].split('@')[0] + ' (*' + c + '/3*)\n\n' + beautifulFooter(), mentions: [m[0]] }); if (c >= 3) { try { await sock.groupParticipantsUpdate(jid, [m[0]], 'remove'); await db.warnClear(m[0], jid); } catch {} } } return; }
                    if (lower.startsWith('.kick ')) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { try { await sock.groupParticipantsUpdate(jid, [m[0]], 'remove'); await sock.sendMessage(jid, { text: '🚫 @' + m[0].split('@')[0] + ' *kicked!*\n\n' + beautifulFooter(), mentions: [m[0]] }); } catch {} } return; }
                    if (lower.startsWith('.add ')) { const n = text.replace('.add', '').trim().replace(/[^0-9]/g, ''); if (n) { try { await sock.groupParticipantsUpdate(jid, [n + '@s.whatsapp.net'], 'add'); await sock.sendMessage(jid, { text: '✅ *' + n + ' added!*\n\n' + beautifulFooter() }); } catch {} } return; }
                    if (lower.startsWith('.promote ')) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { try { await sock.groupParticipantsUpdate(jid, [m[0]], 'promote'); await sock.sendMessage(jid, { text: '👑 @' + m[0].split('@')[0] + ' *promoted!*\n\n' + beautifulFooter(), mentions: [m[0]] }); } catch {} } return; }
                    if (lower.startsWith('.demote ')) { const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid; if (m?.length) { try { await sock.groupParticipantsUpdate(jid, [m[0]], 'demote'); await sock.sendMessage(jid, { text: '⬇️ @' + m[0].split('@')[0] + ' *demoted!*\n\n' + beautifulFooter(), mentions: [m[0]] }); } catch {} } return; }
                }
            }

            // Save
            if (lower === '.save' || lower === `${prefix}save` || lower === '.ss') { const ctx = msg.message?.extendedTextMessage?.contextInfo; if (ctx?.quotedMessage) { const fm = { key: { remoteJid: jid, id: ctx.stanzaId }, message: ctx.quotedMessage }; const sv = await saveMediaToFile(fm); if (sv) { if (sv.type === 'imageMessage') await sock.sendMessage(jid, { image: sv.buffer, caption: '💾 *Saved!*\n\n' + beautifulFooter() }); else if (sv.type === 'videoMessage') await sock.sendMessage(jid, { video: sv.buffer, caption: '💾 *Saved!*\n\n' + beautifulFooter() }); else if (sv.type === 'stickerMessage') await sock.sendMessage(jid, { sticker: sv.buffer }); else await sock.sendMessage(jid, { document: sv.buffer, fileName: sv.filename, caption: '💾 *Saved!*\n\n' + beautifulFooter() }); } else await sock.sendMessage(jid, { text: '❌ *Failed!*\n\n' + beautifulFooter() }); } else await sock.sendMessage(jid, { text: '💡 Reply to media with *' + prefix + 'save*\n\n' + beautifulFooter() }); return; }

            // VV
            if (lower === '.vv' || lower === `${prefix}vv` || lower === 'vv') { const ctx = msg.message?.extendedTextMessage?.contextInfo; if (ctx?.quotedMessage?.imageMessage?.viewOnce || ctx?.quotedMessage?.videoMessage?.viewOnce) { const fm = { key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant }, message: ctx.quotedMessage }; const sv = await saveMediaToFile(fm, VV_FOLDER); if (sv && cleanOwnerJid) { const cap = '📱 *VV Saved!*\n👤 @' + sender.split('@')[0] + '\n\n' + beautifulFooter(); try { if (sv.type === 'imageMessage') await sock.sendMessage(cleanOwnerJid, { image: sv.buffer, caption: cap, mentions: [sender] }); else if (sv.type === 'videoMessage') await sock.sendMessage(cleanOwnerJid, { video: sv.buffer, caption: cap, mentions: [sender] }); } catch (e) {} } await sock.sendMessage(jid, { text: sv ? '✅ *Saved!* 📥\n\n' + beautifulFooter() : '❌ *Failed!*\n\n' + beautifulFooter() }); } else await sock.sendMessage(jid, { text: '💡 Reply to VV with *' + prefix + 'vv*\n\n' + beautifulFooter() }); return; }

            // Anti-link
            if (group && await db.get('antiLinkEnabled', false) && /https?:\/\/(?:chat\.whatsapp\.com|t\.me|discord\.gg)/i.test(text) && !admin && !owner) { try { await sock.sendMessage(jid, { delete: msg.key }); } catch {} await sock.sendMessage(jid, { text: '🔗 *Link Deleted!*\n👤 @' + sender.split('@')[0] + '\n\n' + beautifulFooter(), mentions: [sender] }); return; }

            // AFK Detection
            if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) { for (const m of msg.message.extendedTextMessage.contextInfo.mentionedJid) { const afk = await db.afkGet(m); if (afk) { const mins = Math.floor((Date.now() - new Date(afk.afkAt).getTime()) / 60000); await sock.sendMessage(jid, { text: '💤 @' + m.split('@')[0] + ' *AFK:* ' + afk.reason + ' (' + mins + 'm)\n\n' + beautifulFooter(), mentions: [m] }); } } }
            if (await db.afkGet(sender) && !lower.startsWith('.afk')) await db.afkRemove(sender);
        }
    });

    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (action === 'add' && await db.get('welcomeEnabled', false)) { const wm = await db.get('welcomeMessage', '👋 Welcome @user! 🎉'); for (const p of participants) await sock.sendMessage(id, { text: '🎉 *Welcome!*\n\n' + wm.replace('@user', '@' + p.split('@')[0]) + '\n\n' + beautifulFooter(), mentions: [p] }); }
        if (action === 'remove' && await db.get('goodbyeEnabled', false)) { const gm = await db.get('goodbyeMessage', '👋 Goodbye @user! 😢'); for (const p of participants) await sock.sendMessage(id, { text: '😢 *Goodbye!*\n\n' + gm.replace('@user', '@' + p.split('@')[0]) + '\n\n' + beautifulFooter(), mentions: [p] }); }
    });

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) { console.log('\n📱 Scan QR Code:\n'); qrcode.generate(qr, { small: true }); }
        if (connection === 'close') { isConnected = false; sock = null; const code = lastDisconnect?.error?.output?.statusCode; if (code !== DisconnectReason.loggedOut && !isShuttingDown) { reconnectAttempts++; reconnectTimer = setTimeout(async () => { reconnectTimer = null; await startBot(); }, Math.min(30000, 5000 * reconnectAttempts)); } }
        else if (connection === 'open') {
            isConnected = true; reconnectAttempts = 0;
            if (sock.user) {
                ownerJid = sock.user.id; ownerPhone = ownerJid.split(':')[0].split('@')[0];
                ownerDeviceId = ownerJid.includes(':') ? ownerJid.split(':')[1].split('@')[0] : 'PRIMARY';
                ownerLid = sock.user.lid || 'N/A'; cleanOwnerJid = ownerPhone + '@s.whatsapp.net';
                console.log('\n' + '═'.repeat(50) + '\n  💝 NewsBot LK - Connected! 💝\n' + '═'.repeat(50) + `\n  👑 ${ownerJid}\n  📱 ${ownerPhone}\n  🔗 ${ownerDeviceId}\n  🆔 ${ownerLid}\n  📨 ${cleanOwnerJid}\n  🗄️ ${useJsonFallback ? 'JSON' : 'MongoDB'}\n  🦄 v${config.version}\n` + '═'.repeat(50) + '\n');
                setTimeout(() => sendConnectedMessage(0), 5000);
            }
            setTimeout(async () => { if (await db.get('autoNewsEnabled', true)) await checkAndShareAllNewNews(); }, 10000);
            setTimeout(async () => await updateBotBio(), 15000);
        }
    });
    sock.ev.on('creds.update', saveCreds);
}

// ============================================================
// 📰 NEWS SYSTEM
// ============================================================
async function scrapeArticle(url) { try { const { data: html } = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!html) return { description: '', image: '' }; let img = ''; const og = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i); if (og?.[1]) img = og[1]; const ch = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, ''); let d = ''; for (const rx of [/<div[^>]*class="[^"]*news-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i, /<article[^>]*>([\s\S]*?)<\/article>/i]) { const m = ch.match(rx); if (m?.[1]) { const ps = m[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi); if (ps) { d = ps.map(p => p.replace(/<[^>]*>/g, '').trim()).filter(p => p.length > 30).join('\n\n'); if (d.length > 200) break; } } } if (!d) { const ps = ch.match(/<p[^>]*>([\s\S]*?)<\/p>/gi); if (ps) d = ps.map(p => p.replace(/<[^>]*>/g, '').trim()).filter(p => p.length > 30).join('\n\n'); } return { description: cleanText(d || ''), image: img }; } catch { return { description: '', image: '' }; } }
async function fetchHiruNews() { const a = new Hiru(); const cats = ['BreakingNews','MainNews','TrendingNews']; const n = []; const s = new Set(); for (const c of cats) { if (typeof a[c] !== 'function') continue; try { const i = await a[c](); const u = i?.results?.newsURL, t = i?.results?.title; if (u && !s.has(u) && t) { s.add(u); n.push({ source:'🇱🇰 Hiru News', category:c.replace('News',''), title:t, description:cleanText(i.results.news||''), url:u, image:i.results.thumb||'', date:i.results.date||'' }); } } catch {} } return n; }
async function fetchDeranaNews() { const n = []; try { const r = await Derana.scrapeHotNews(); if (Array.isArray(r)) { for (const a of r.slice(0,3)) { const u = a.url||'', t = a.title||''; if (u&&t) { const { description, image } = await scrapeArticle(u); let d = description; if (!d||d.length<100) { d = a.content||a.description||t; d = String(d).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(); } n.push({ source:'🔴 Derana', category:'Hot News', title:t, description:d, url:u, image:image||FALLBACK_IMAGE, date:a.time||'' }); await new Promise(r=>setTimeout(r,500)); } } } } catch {} return n; }
async function fetchRSS(url, source, limit = 3) { const n = []; try { const { data } = await axios.get(url,{timeout:10000,headers:{'User-Agent':'Mozilla/5.0'}}); const items = data.match(/<item>([\s\S]*?)<\/item>/gi)||[]; for (const i of items.slice(0,limit)) { const t = (i.match(/<title>([^<]+)<\/title>/i)||[])[1]?.trim()||''; const u = (i.match(/<link>([^<]+)<\/link>/i)||[])[1]?.trim()||''; const img = (i.match(/<media:content[^>]*url="([^"]*)"/i)||[])[1]?.trim()||''; if (t&&u) { const { description } = await scrapeArticle(u); n.push({ source, category:'Latest', title:t, description:description||t, url:u, image:img||FALLBACK_IMAGE, date:'' }); await new Promise(r=>setTimeout(r,500)); } } } catch {} return n; }
async function fetchAllLatestNews() { const src = [{ n:'Hiru', f:fetchHiruNews },{ n:'Derana', f:fetchDeranaNews },{ n:'AdaDerana', f:()=>fetchRSS('https://www.adaderana.lk/rss.php','📰 AdaDerana') },{ n:'Cricket', f:()=>fetchRSS('https://www.espncricinfo.com/rss/content/story/feeds/8.xml','🏏 ESPN',2) },{ n:'Ada.lk', f:async()=>{ try{ const r=await dynews.ada(); if(r?.status&&r.result?.url){ const d=cleanText(r.result.desc||''); if(d.length>50)return[{source:'📰 Ada.lk',category:'Latest',title:r.result.title,description:d,url:r.result.url,image:r.result.image||FALLBACK_IMAGE,date:`${r.result.date} ${r.result.time}`}]; } }catch{} return[]; } },{ n:'Newswire', f:async()=>{ try{ const r=await dynews.newswire(); if(r?.status&&r.result?.url){ const d=cleanText(r.result.desc||''); if(d.length>50)return[{source:'📰 Newswire',category:'Latest',title:r.result.title,description:d,url:r.result.url,image:r.result.image||FALLBACK_IMAGE,date:`${r.result.date} ${r.result.time}`}]; } }catch{} return[]; } },{ n:'Sirasa', f:async()=>{ try{ const r=await dynews.sirasa(); if(r?.status&&r.result?.url){ const d=cleanText(r.result.desc||''); if(d.length>50)return[{source:'📺 Sirasa',category:'Latest',title:r.result.title,description:d,url:r.result.url,image:r.result.image||FALLBACK_IMAGE,date:`${r.result.date} ${r.result.time}`}]; } }catch{} return[]; } }]; const res = await Promise.allSettled(src.map(s=>s.f())); const all = []; src.forEach((s,i)=>{ if(res[i].status==='fulfilled'&&Array.isArray(res[i].value)&&res[i].value.length){ all.push(...res[i].value); } }); const uniq = []; const seen = new Set(); for (const x of all) { if (x.url&&!seen.has(x.url)) { seen.add(x.url); uniq.push(x); } } return uniq; }

// ✅ BEAUTIFUL NEWS FORMAT (like you showed)
async function sendNews(jid, article) {
    if (!sock?.user) return false;
    const desc = truncate((article.description||article.title||'').trim(), 5000);
    const formattedDesc = desc.split('\n\n').map(p => p.trim()).filter(p => p.length > 0).join('\n\n');
    const cap = [
        '┌' + '─'.repeat(38) + '┐',
        '│  📰 *' + article.source + '*',
        '│  📌 *' + article.category + '*',
        '└' + '─'.repeat(38) + '┘',
        '',
        '*📌 ' + article.title + '*',
        '',
        formattedDesc,
        '',
        article.date ? '📅 *' + article.date + '*' : '',
        '🔗 ' + article.url,
        '',
        beautifulFooter()
    ].join('\n');
    try {
        let sent;
        if (article.image?.length>10) { try { sent = await sock.sendMessage(jid,{image:{url:article.image},caption:cap,mimetype:'image/jpeg'}); } catch {} }
        if (!sent) sent = await sock.sendMessage(jid,{image:{url:BOT_LOGO},caption:cap,mimetype:'image/png'});
        await sock.sendMessage(jid,{react:{text:randEmoji(REACTIONS),key:sent.key}});
        return true;
    } catch { return false; }
}

async function checkAndShareAllNewNews() { if (!sock?.user||await db.groupGet(NEWS_GROUP_JID,'isMuted',false)) return; try { const all = await fetchAllLatestNews(); if (!all.length) return; const urls = await db.urlsGet(); if (!urls.length) { for (const i of all) { if (i.url) await db.urlsAdd(i.url); } return; } let s=0; for (const i of all) { if (!i.url||urls.includes(i.url)) continue; if (await sendNews(NEWS_GROUP_JID,i)) { await db.urlsAdd(i.url); s++; } await new Promise(r=>setTimeout(r,3000)); } if (s>0) console.log(`📰 Shared ${s} new articles`); } catch (e) {} }

// ============================================================
// 🚀 STARTUP
// ============================================================
(async () => {
    console.log('\n' + '═'.repeat(50) + '\n  💝 NewsBot LK v' + config.version + ' 💝\n' + '═'.repeat(50) + '\n  👨‍💻 ' + config.developer + '\n  👑 ' + OWNER_NUMBERS.join(', ') + '\n  🌐 ' + config.portfolio + '\n' + '═'.repeat(50) + '\n  💝 Dedicated to:\n  🌸 Umesha Sathyanjali\n  🌸 Mithila\n  🌸 Sharada\n' + '═'.repeat(50) + '\n');
    await connectDatabase();
    await startBot();
    setInterval(async () => { if (await db.get('autoNewsEnabled', true)) await checkAndShareAllNewNews(); }, CHECK_INTERVAL_MS);
    setInterval(async () => await updateBotBio(), 30 * 60 * 1000);
    console.log('🦄💝 NewsBot LK is running! 💝🦄\n');
})();
