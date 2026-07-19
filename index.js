// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🦄 Beautiful Edition 🦄                    ║
// ║              Developed by Charuka Mahesh                     ║
// ║     Dedicated to Umesha Sathyanjali | Mithila | Sharada     ║
// ║                  Version: 9.0.0 ✨                           ║
// ╚══════════════════════════════════════════════════════════════╝

// ============================================================
// 📦 DEPENDENCIES
// ============================================================
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const mongoose = require('mongoose');
const Hiru = require('hirunews-scrap');
const Derana = require('ada-derana-news-scraper');
const DY_NEWS = require('@dark-yasiya/news-scrap');
const config = require('./config');

const dynews = new DY_NEWS();

// ============================================================
// 🎵 LOAD VOICE REPLIES
// ============================================================
let voiceReplies = { replies: {} };

try {
    const voiceFilePath = path.join(__dirname, 'voiceReplies.json');
    if (fs.existsSync(voiceFilePath)) {
        const voiceData = JSON.parse(fs.readFileSync(voiceFilePath, 'utf8'));
        voiceReplies = voiceData;
        console.log('🎵 Loaded voice replies from voiceReplies.json');
        console.log(`   📝 ${Object.keys(voiceReplies.replies || {}).length} voice triggers loaded`);
    } else {
        console.log('⚠️ voiceReplies.json not found - voice replies disabled');
    }
} catch (e) {
    console.log('⚠️ Error loading voiceReplies.json:', e.message);
}

// ============================================================
// ⚙️ CONFIGURATION FROM config.js
// ============================================================
const OWNER_NUMBERS = Array.isArray(config.ownerNumber) 
    ? config.ownerNumber 
    : [config.ownerNumber];

const NEWS_GROUP_JID = config.newsGroupJid;
const CHECK_INTERVAL_MS = config.checkIntervalMs || 120000;
const BOT_LOGO = config.botLogo;
const FALLBACK_IMAGE = config.fallbackImage;
const REACTIONS = config.reactions || ['📰', '🔥', '👍', '💯', '👏'];
const STATUS_EMOJIS = config.statusEmojis || ['🖤', '❤️', '🔥', '👍', '💯'];

const SAVE_FOLDER = path.join(__dirname, 'saved_media');
const STATUS_FOLDER = path.join(__dirname, 'saved_status');
const VV_FOLDER = path.join(__dirname, 'view_once_saved');

// Create required folders
[SAVE_FOLDER, STATUS_FOLDER, VV_FOLDER].forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
});

// ============================================================
// 🗄️ JSON DATABASE (Fallback)
// ============================================================
const JSON_DB_FILE = path.join(__dirname, 'database.json');
let useJsonFallback = false;

let jsonDb = {
    settings: {
        ...config.defaults,
        botMode: 'public',
        prefix: '.',
        autoNewsEnabled: true,
        autoStatusView: true,
        autoStatusReact: true,
        autoStatusSave: true,
        voiceReplyEnabled: true,
        autoBioEnabled: true,
        antiLinkEnabled: false,
        welcomeEnabled: false,
        goodbyeEnabled: false
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
            const data = JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8'));
            jsonDb = {
                settings: { ...jsonDb.settings, ...(data.settings || {}) },
                warnings: data.warnings || {},
                bans: data.bans || [],
                afk: data.afk || {},
                groupSettings: data.groupSettings || {},
                sentUrls: data.sentUrls || []
            };
        } else {
            saveJsonDb();
        }
    } catch (e) {
        console.error('❌ JSON DB Load Error:', e.message);
        saveJsonDb();
    }
}

function saveJsonDb() {
    try {
        fs.writeFileSync(JSON_DB_FILE, JSON.stringify(jsonDb, null, 2));
    } catch (e) {
        console.error('❌ JSON DB Save Error:', e.message);
    }
}

loadJsonDb();

// ============================================================
// 🍃 MONGODB SCHEMAS
// ============================================================
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

const newsUrlSchema = new mongoose.Schema({
    url: { type: String, unique: true, required: true },
    sentAt: { type: Date, default: Date.now }
});

let Setting, Warning, Ban, Afk, GroupSetting, NewsUrl;

// ============================================================
// 🔌 DATABASE CONNECTION
// ============================================================
async function connectDatabase() {
    if (process.env.MONGO_ENABLED === 'false') {
        useJsonFallback = true;
        loadJsonDb();
        console.log('🗄️ Using JSON Database');
        return false;
    }

    const urls = [
        { url: config.mongoInternal },
        { url: config.mongoPublic }
    ];

    for (const { url } of urls) {
        try {
            await mongoose.connect(url, {
                dbName: config.dbName || 'newsbot_db',
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                ssl: false,
                tls: false,
                retryWrites: false,
                tlsAllowInvalidCertificates: true,
                tlsAllowInvalidHostnames: true
            });

            Setting = mongoose.model('Setting', settingSchema);
            Warning = mongoose.model('Warning', warningSchema);
            Ban = mongoose.model('Ban', banSchema);
            Afk = mongoose.model('Afk', afkSchema);
            GroupSetting = mongoose.model('GroupSetting', groupSettingSchema);
            NewsUrl = mongoose.model('NewsUrl', newsUrlSchema);

            if (await Setting.countDocuments() === 0) {
                for (const [key, value] of Object.entries(config.defaults)) {
                    await Setting.create({ key, value });
                }
            }

            console.log('✅ MongoDB Connected');
            return true;

        } catch (error) {
            console.error('❌ MongoDB Connection Failed:', error.message);
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }
        }
    }

    useJsonFallback = true;
    loadJsonDb();
    console.log('⚠️ Falling back to JSON Database');
    return false;
}

// ============================================================
// 🗃️ DATABASE OPERATIONS
// ============================================================
const db = {
    isJson: () => useJsonFallback,

    get: async (key, defaultValue) => {
        if (useJsonFallback || !Setting) {
            return jsonDb.settings[key] ?? config.defaults[key] ?? defaultValue;
        }
        try {
            const record = await Setting.findOne({ key });
            return record ? record.value : (config.defaults[key] ?? defaultValue);
        } catch {
            return config.defaults[key] ?? defaultValue;
        }
    },

    set: async (key, value) => {
        console.log(`💾 DB: ${key} = ${value}`);
        if (useJsonFallback || !Setting) {
            jsonDb.settings[key] = value;
            saveJsonDb();
            return true;
        }
        try {
            await Setting.updateOne(
                { key },
                { $set: { key, value, updatedAt: new Date() } },
                { upsert: true }
            );
            return true;
        } catch {
            return false;
        }
    },

    all: async () => {
        if (useJsonFallback || !Setting) {
            return { ...config.defaults, ...jsonDb.settings };
        }
        try {
            const docs = await Setting.find({});
            const settings = {};
            docs.forEach(doc => { settings[doc.key] = doc.value; });
            return { ...config.defaults, ...settings };
        } catch {
            return { ...config.defaults };
        }
    },

    warnAdd: async (userId, groupId) => {
        if (useJsonFallback || !Warning) {
            const key = `${userId}_${groupId}`;
            jsonDb.warnings[key] = (jsonDb.warnings[key] || 0) + 1;
            saveJsonDb();
            return jsonDb.warnings[key];
        }
        try {
            const result = await Warning.findOneAndUpdate(
                { userId, groupId },
                { $inc: { count: 1 } },
                { upsert: true, new: true }
            );
            return result?.count || 0;
        } catch {
            return 0;
        }
    },

    warnClear: async (userId, groupId) => {
        if (useJsonFallback || !Warning) {
            delete jsonDb.warnings[`${userId}_${groupId}`];
            saveJsonDb();
            return true;
        }
        try {
            await Warning.deleteMany({ userId, groupId });
            return true;
        } catch {
            return false;
        }
    },

    banAdd: async (userId, reason = '') => {
        if (useJsonFallback || !Ban) {
            if (!jsonDb.bans.find(b => b.userId === userId)) {
                jsonDb.bans.push({ userId, reason, bannedAt: new Date().toISOString() });
                saveJsonDb();
            }
            return true;
        }
        try {
            await Ban.updateOne(
                { userId },
                { $set: { userId, reason, bannedAt: new Date() } },
                { upsert: true }
            );
            return true;
        } catch {
            return false;
        }
    },

    banRemove: async (userId) => {
        if (useJsonFallback || !Ban) {
            jsonDb.bans = jsonDb.bans.filter(b => b.userId !== userId);
            saveJsonDb();
            return true;
        }
        try {
            await Ban.deleteOne({ userId });
            return true;
        } catch {
            return false;
        }
    },

    banCheck: async (userId) => {
        if (useJsonFallback || !Ban) {
            return jsonDb.bans.some(b => b.userId === userId);
        }
        try {
            return !!(await Ban.findOne({ userId }));
        } catch {
            return false;
        }
    },

    banAll: async () => {
        if (useJsonFallback || !Ban) return jsonDb.bans;
        try {
            return await Ban.find({});
        } catch {
            return [];
        }
    },

    afkSet: async (userId, reason) => {
        if (useJsonFallback || !Afk) {
            jsonDb.afk[userId] = { userId, reason, afkAt: new Date().toISOString() };
            saveJsonDb();
            return true;
        }
        try {
            await Afk.updateOne(
                { userId },
                { $set: { userId, reason, afkAt: new Date() } },
                { upsert: true }
            );
            return true;
        } catch {
            return false;
        }
    },

    afkRemove: async (userId) => {
        if (useJsonFallback || !Afk) {
            delete jsonDb.afk[userId];
            saveJsonDb();
            return true;
        }
        try {
            await Afk.deleteOne({ userId });
            return true;
        } catch {
            return false;
        }
    },

    afkGet: async (userId) => {
        if (useJsonFallback || !Afk) return jsonDb.afk[userId] || null;
        try {
            return await Afk.findOne({ userId });
        } catch {
            return null;
        }
    },

    groupGet: async (groupId, key, defaultValue) => {
        if (useJsonFallback || !GroupSetting) {
            return jsonDb.groupSettings[groupId]?.[key] ?? defaultValue;
        }
        try {
            const record = await GroupSetting.findOne({ groupId });
            return record?.[key] ?? defaultValue;
        } catch {
            return defaultValue;
        }
    },

    groupSet: async (groupId, key, value) => {
        if (useJsonFallback || !GroupSetting) {
            if (!jsonDb.groupSettings[groupId]) {
                jsonDb.groupSettings[groupId] = {};
            }
            jsonDb.groupSettings[groupId][key] = value;
            saveJsonDb();
            return true;
        }
        try {
            await GroupSetting.updateOne(
                { groupId },
                { $set: { [key]: value } },
                { upsert: true }
            );
            return true;
        } catch {
            return false;
        }
    },

    urlsGet: async () => {
        if (useJsonFallback || !NewsUrl) return jsonDb.sentUrls || [];
        try {
            const docs = await NewsUrl.find({});
            return docs.map(d => d.url);
        } catch {
            return [];
        }
    },

    urlsAdd: async (url) => {
        if (useJsonFallback || !NewsUrl) {
            if (!jsonDb.sentUrls.includes(url)) {
                jsonDb.sentUrls.push(url);
                saveJsonDb();
            }
            return true;
        }
        try {
            await NewsUrl.updateOne(
                { url },
                { $set: { url, sentAt: new Date() } },
                { upsert: true }
            );
            return true;
        } catch {
            return false;
        }
    },

    urlsCount: async () => {
        if (useJsonFallback || !NewsUrl) return jsonDb.sentUrls.length;
        try {
            return await NewsUrl.countDocuments();
        } catch {
            return 0;
        }
    }
};

// ============================================================
// 🎨 BEAUTIFUL UI SYSTEM
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

const sectionDivider = (title, emoji) => {
    const line = '─'.repeat(8);
    return `\n${emoji} ${line} *${title}* ${line} ${emoji}\n`;
};

const statusBadge = (enabled) => {
    return enabled ? '✅ *ON*' : '❌ *OFF*';
};

const randEmoji = (array) => {
    return array[Math.floor(Math.random() * array.length)];
};

// ============================================================
// 🔐 AUTHENTICATION
// ============================================================
let sock = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let isConnected = false;
let isShuttingDown = false;
let lastStatusTime = 0;
let ownerJid = null;

function isOwner(senderNumber, senderJid) {
    const cleanNumber = senderNumber.replace(/[^0-9]/g, '');
    
    if (OWNER_NUMBERS.some(num => num.replace(/[^0-9]/g, '') === cleanNumber)) {
        return true;
    }
    
    if (ownerJid && senderJid === ownerJid) return true;
    if (ownerJid && ownerJid.split('@')[0].replace(/[^0-9]/g, '') === cleanNumber) return true;
    
    return false;
}

async function checkAdmin(jid, sender) {
    try {
        const metadata = await sock.groupMetadata(jid);
        const participant = metadata.participants.find(p => p.id === sender);
        return participant?.admin != null;
    } catch {
        return false;
    }
}

// ============================================================
// 📥 MEDIA FUNCTIONS - FIXED
// ============================================================

async function downloadMedia(msg) {
    try {
        const baileys = await import('@whiskeysockets/baileys');
        const buffer = await baileys.downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
                logger: {
                    info: () => {},
                    error: () => {},
                    warn: () => {}
                }
            }
        );
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

        // Handle view-once messages
        if (messageType.includes('viewOnce')) {
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
            'stickerMessage': '.webp'
        };

        const extension = extensionMap[messageType];
        if (!extension) return null;

        const buffer = await downloadMedia(realMessage);
        if (!buffer || buffer.length < 100) return null;

        const filename = `media_${Date.now()}${extension}`;
        const filePath = path.join(folder, filename);
        fs.writeFileSync(filePath, buffer);

        return {
            buffer,
            type: messageType,
            ext: extension,
            filename,
            filePath
        };
    } catch (e) {
        console.error('❌ saveMediaToFile error:', e.message);
        return null;
    }
}

// ============================================================
// 🎵 VOICE REPLY HANDLER - Skip Owner
// ============================================================
async function handleVoiceReply(jid, text, msg, isUserOwner) {
    if (isUserOwner) {
        console.log(`👑 Owner (${jid}) - Voice reply skipped`);
        return false;
    }
    
    if (!await db.get('voiceReplyEnabled', true)) {
        console.log('🔇 Voice replies disabled');
        return false;
    }
    
    if (!voiceReplies.replies || Object.keys(voiceReplies.replies).length === 0) {
        console.log('⚠️ No voice replies loaded');
        return false;
    }

    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);

    for (const [trigger, url] of Object.entries(voiceReplies.replies)) {
        const triggerLower = trigger.toLowerCase();
        
        let matched = false;
        if (lower === triggerLower) {
            matched = true;
        } else if (words.includes(triggerLower)) {
            matched = true;
        } else if (triggerLower.includes(' ') && lower.includes(triggerLower)) {
            matched = true;
        }

        if (matched) {
            try {
                console.log(`🎵 Sending voice: ${trigger} to ${jid}`);
                const response = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 20000
                });
                
                const buffer = Buffer.from(response.data);
                if (buffer.length > 100) {
                    const sent = await sock.sendMessage(jid, {
                        audio: buffer,
                        mimetype: 'audio/mpeg',
                        ptt: true
                    }, { quoted: msg });
                    
                    await sock.sendMessage(jid, {
                        react: { text: '🎵', key: sent.key }
                    });
                    return true;
                }
            } catch (e) {
                console.error(`❌ Voice error for ${trigger}:`, e.message);
            }
            break;
        }
    }
    return false;
}

// ============================================================
// 🖤 AUTO STATUS VIEW & SAVE
// ============================================================
async function handleStatus(msg) {
    if (!sock) return;

    try {
        const { key } = msg;
        if (key.fromMe) return;

        const participant = key.participant || key.remoteJid;
        if (!participant || participant === sock.user?.id) return;

        if (Date.now() - lastStatusTime < 3000) return;
        lastStatusTime = Date.now();

        // Auto view status
        if (await db.get('autoStatusView', true)) {
            console.log(`👁️ Auto viewing status from: ${participant}`);
            await sock.readMessages([key]);
        }

        // Auto react to status
        if (await db.get('autoStatusReact', true)) {
            const emoji = randEmoji(STATUS_EMOJIS);
            try {
                await sock.sendMessage('status@broadcast', {
                    react: { text: emoji, key }
                });
                console.log(`❤️ Auto reacted to status: ${emoji}`);
            } catch (e) {}
        }

        // Auto save status to folder
        if (await db.get('autoStatusSave', true)) {
            console.log('💾 Auto saving status...');
            const saved = await saveMediaToFile(msg, STATUS_FOLDER);
            if (saved) {
                console.log(`✅ Status saved: ${saved.filename}`);
                
                // Forward to owner
                if (ownerJid) {
                    const senderNumber = participant.split('@')[0].replace(/:.*/, '');
                    const caption = `📱 *Status from +${senderNumber}*\n📅 ${new Date().toLocaleString()}\n\n${beautifulFooter()}`;
                    try {
                        if (saved.type === 'imageMessage') {
                            await sock.sendMessage(ownerJid, { image: saved.buffer, caption });
                        } else if (saved.type === 'videoMessage') {
                            await sock.sendMessage(ownerJid, { video: saved.buffer, caption });
                        }
                        console.log(`📤 Status forwarded to owner`);
                    } catch (e) {}
                }
            }
        }
    } catch (e) {
        console.error('❌ handleStatus error:', e.message);
    }
}

// ============================================================
// 📰 NEWS SYSTEM - CLEAN TEXT
// ============================================================

function cleanNewsText(text) {
    if (!text) return '';
    let cleaned = text
        // Remove HTML tags
        .replace(/<[^>]*>/g, '')
        // Remove scripts and styles
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        // Remove special characters
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&ndash;/g, '-')
        .replace(/&mdash;/g, '-')
        .replace(/&#8211;/g, '-')
        .replace(/&#8212;/g, '-')
        .replace(/&#8216;/g, "'")
        .replace(/&#8217;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        // Remove garbage text
        .replace(/ENGLISH.*?Home/gi, '')
        .replace(/Your browser does not support iframes.*$/gi, '')
        .replace(/Copyright.*$/gi, '')
        .replace(/Solution by.*$/gi, '')
        .replace(/X Youtube Rss Email Alerts/gi, '')
        .replace(/window\.[^;]*;?/gi, '')
        .replace(/googletag\.[^;]*;?/gi, '')
        .replace(/function\([^)]*\)[^{]*\{[^}]*\}/gi, '')
        .replace(/#[a-zA-Z0-9_-]+\s*\{[^}]*\}/gi, '')
        .replace(/@media[^{]*\{[^}]*\}/gi, '')
        .replace(/-->+/g, '')
        // Remove extra spaces and line breaks
        .replace(/\s+/g, ' ')
        .trim();
    
    return cleaned;
}

function smartTruncate(text, maxLength = 3000) {
    if (!text || text.length <= maxLength) return text;
    const truncated = text.substring(0, maxLength);
    const cutPoints = [
        truncated.lastIndexOf('. '), 
        truncated.lastIndexOf('? '), 
        truncated.lastIndexOf('! '), 
        truncated.lastIndexOf('\n'), 
        truncated.lastIndexOf('।')
    ].filter(p => p > maxLength * 0.6);
    if (cutPoints.length > 0) return truncated.substring(0, Math.max(...cutPoints) + 1).trim();
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) return truncated.substring(0, lastSpace).trim() + '...';
    return truncated.trim() + '...';
}

async function scrapeArticleWithImage(url) {
    try {
        const res = await axios.get(url, { 
            timeout: 15000, 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } 
        });
        const html = res.data;
        if (!html || typeof html !== 'string') return { description: '', image: '' };
        
        let img = '';
        const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogImage?.[1]) img = ogImage[1];
        
        if (!img && url.includes('sinhala.adaderana.lk')) {
            const id = url.split('/').pop();
            img = `https://sinhala.adaderana.lk/news/featured-image/${id}`;
        }
        
        let cleanHtml = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '');
        
        let desc = '';
        const divs = [
            /<div[^>]*class="[^"]*news-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<article[^>]*>([\s\S]*?)<\/article>/i
        ];
        
        for (const r of divs) {
            const m = cleanHtml.match(r);
            if (m?.[1]) { 
                const ps = m[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi); 
                if (ps) { 
                    desc = ps.map(p => p.replace(/<[^>]*>/g, '').trim())
                              .filter(p => p.length > 30 && !p.includes('googletag') && !p.includes('window.'))
                              .join('\n\n'); 
                    if (desc.length > 200) break; 
                } 
            }
        }
        
        if (!desc || desc.length < 100) {
            const ps = cleanHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
            if (ps) desc = ps.map(p => p.replace(/<[^>]*>/g, '').trim())
                            .filter(p => p.length > 30 && !p.includes('googletag') && !p.includes('window.') && !p.includes('function(') && !p.includes('defineslot'))
                            .join('\n\n');
        }
        
        return { description: cleanNewsText(desc || ''), image: img };
    } catch (e) { 
        console.error('❌ Scrape error:', e.message);
        return { description: '', image: '' }; 
    }
}

async function fetchHiruNews() { 
    const a = new Hiru(); 
    const cats = ['BreakingNews','MainNews','TrendingNews']; 
    const n = []; 
    const s = new Set(); 
    for (const c of cats) { 
        if (typeof a[c] !== 'function') continue; 
        try { 
            const i = await a[c](); 
            const u = i?.results?.newsURL, t = i?.results?.title; 
            if (u && !s.has(u) && t) { 
                s.add(u);
                const { description, image } = await scrapeArticleWithImage(u);
                n.push({
                    source:'🇱🇰 Hiru News', 
                    category:c.replace('News',''), 
                    title:cleanNewsText(t), 
                    description:cleanNewsText(description || i.results.news || ''), 
                    url:u, 
                    image:image || i.results.thumb || FALLBACK_IMAGE, 
                    date:i.results.date||'' 
                }); 
            } 
        } catch(e) {} 
    } 
    return n; 
}

async function fetchDeranaNews() { 
    const n = []; 
    try { 
        const r = await Derana.scrapeHotNews(); 
        if (Array.isArray(r)) { 
            for (const a of r.slice(0,3)) { 
                const u = a.url||'', t = a.title||''; 
                if (u&&t) { 
                    const { description, image } = await scrapeArticleWithImage(u); 
                    let d = cleanNewsText(description || a.content || a.description || t); 
                    n.push({ 
                        source:'🔴 Ada Derana', 
                        category:'Hot News', 
                        title:cleanNewsText(t), 
                        description:d, 
                        url:u, 
                        image:image || FALLBACK_IMAGE, 
                        date:a.time||'' 
                    }); 
                    await new Promise(r=>setTimeout(r,500)); 
                } 
            } 
        } 
    } catch(e) { 
        console.error('❌ Derana fetch error:', e.message);
    } 
    return n; 
}

async function fetchAdaDeranaRSS() { 
    const n = []; 
    try { 
        const r = await axios.get('https://www.adaderana.lk/rss.php',{
            timeout:10000,
            headers:{'User-Agent':'Mozilla/5.0'}
        }); 
        const items = r.data.match(/<item>([\s\S]*?)<\/item>/gi)||[]; 
        for (const i of items.slice(0,3)) { 
            const t = (i.match(/<title>([^<]+)<\/title>/i)||[])[1]?.trim()||''; 
            const u = (i.match(/<link>([^<]+)<\/link>/i)||[])[1]?.trim()||''; 
            if (t&&u) { 
                const { description, image } = await scrapeArticleWithImage(u); 
                n.push({ 
                    source:'📰 AdaDerana RSS', 
                    category:'Latest', 
                    title:cleanNewsText(t), 
                    description:cleanNewsText(description || t), 
                    url:u, 
                    image:image||FALLBACK_IMAGE, 
                    date:'' 
                }); 
                await new Promise(r=>setTimeout(r,500)); 
            } 
        } 
    } catch(e) {} 
    return n; 
}

async function fetchSirasaNews() { 
    const n = []; 
    try { 
        const r = await dynews.sirasa(); 
        if (r?.status&&r?.result) { 
            const x = r.result; 
            if (x.url&&x.title) { 
                const d = cleanNewsText(x.desc||''); 
                if (d.length>50) {
                    const { description, image } = await scrapeArticleWithImage(x.url);
                    n.push({ 
                        source:'📺 Sirasa TV', 
                        category:'Latest', 
                        title:cleanNewsText(x.title), 
                        description:cleanNewsText(description || d || x.title), 
                        url:x.url, 
                        image:image || x.image || FALLBACK_IMAGE, 
                        date:`${x.date} ${x.time}`||'' 
                    }); 
                } 
            } 
        } 
    } catch(e) { 
        console.error('❌ Sirasa fetch error:', e.message);
    } 
    return n; 
}

async function fetchAdaLkNews() { 
    const n = []; 
    try { 
        const r = await dynews.ada(); 
        if (r?.status&&r?.result) { 
            const x = r.result; 
            if (x.url&&x.title) { 
                const d = cleanNewsText(x.desc||''); 
                if (d.length>50) {
                    const { description, image } = await scrapeArticleWithImage(x.url);
                    n.push({ 
                        source:'📰 Ada.lk', 
                        category:'Latest', 
                        title:cleanNewsText(x.title), 
                        description:cleanNewsText(description || d || x.title), 
                        url:x.url, 
                        image:image || x.image || FALLBACK_IMAGE, 
                        date:`${x.date} ${x.time}`||'' 
                    }); 
                } 
            } 
        } 
    } catch(e) { 
        console.error('❌ Ada.lk fetch error:', e.message);
    } 
    return n; 
}

async function fetchNewswireNews() { 
    const n = []; 
    try { 
        const r = await dynews.newswire(); 
        if (r?.status&&r?.result) { 
            const x = r.result; 
            if (x.url&&x.title) { 
                const d = cleanNewsText(x.desc||''); 
                if (d.length>50) {
                    const { description, image } = await scrapeArticleWithImage(x.url);
                    n.push({ 
                        source:'📰 Newswire', 
                        category:'Latest', 
                        title:cleanNewsText(x.title), 
                        description:cleanNewsText(description || d || x.title), 
                        url:x.url, 
                        image:image || x.image || FALLBACK_IMAGE, 
                        date:`${x.date} ${x.time}`||'' 
                    }); 
                } 
            } 
        } 
    } catch(e) { 
        console.error('❌ Newswire fetch error:', e.message);
    } 
    return n; 
}

async function fetchCricketNews() { 
    const n = []; 
    try { 
        const r = await axios.get('https://www.espncricinfo.com/rss/content/story/feeds/8.xml',{
            timeout:15000,
            headers:{'User-Agent':'Mozilla/5.0'}
        }); 
        const items = r.data.match(/<item>([\s\S]*?)<\/item>/gi)||[]; 
        for (const i of items.slice(0,2)) { 
            const t = (i.match(/<title>([^<]+)<\/title>/i)||[])[1]?.trim()||''; 
            const u = (i.match(/<link>([^<]+)<\/link>/i)||[])[1]?.trim()||''; 
            const img = (i.match(/<media:content[^>]*url="([^"]*)"/i)||[])[1]?.trim()||''; 
            if (t&&u) { 
                const { description } = await scrapeArticleWithImage(u); 
                n.push({ 
                    source:'🏏 ESPN Cricket', 
                    category:'Cricket', 
                    title:cleanNewsText(t), 
                    description:cleanNewsText(description || t), 
                    url:u, 
                    image:img||FALLBACK_IMAGE, 
                    date:'' 
                }); 
                await new Promise(r=>setTimeout(r,500)); 
            } 
        } 
    } catch(e) { 
        console.error('❌ Cricket fetch error:', e.message);
    } 
    return n; 
}

async function fetchAllLatestNews() {
    console.log('\n📰 Fetching news from all sources...');
    
    const sources = [
        { name: 'Hiru', fetch: fetchHiruNews },
        { name: 'Derana', fetch: fetchDeranaNews },
        { name: 'AdaDerana RSS', fetch: fetchAdaDeranaRSS },
        { name: 'Sirasa', fetch: fetchSirasaNews },
        { name: 'Ada.lk', fetch: fetchAdaLkNews },
        { name: 'Newswire', fetch: fetchNewswireNews },
        { name: 'ESPN Cricket', fetch: fetchCricketNews }
    ];
    
    const results = await Promise.allSettled(sources.map(s => s.fetch()));
    const allNews = [];
    
    sources.forEach((source, index) => {
        if (results[index].status === 'fulfilled' && 
            Array.isArray(results[index].value) && 
            results[index].value.length > 0) {
            console.log(`  ✅ ${source.name}: ${results[index].value.length} articles`);
            allNews.push(...results[index].value);
        } else {
            console.log(`  ❌ ${source.name}: Failed or no articles`);
        }
    });
    
    const uniqueNews = [];
    const seenUrls = new Set();
    for (const article of allNews) {
        if (article.url && !seenUrls.has(article.url)) {
            seenUrls.add(article.url);
            uniqueNews.push(article);
        }
    }
    
    console.log(`📊 Total: ${allNews.length} | Unique: ${uniqueNews.length}\n`);
    return uniqueNews;
}

async function sendNewsToJid(jid, article) {
    if (!sock?.user) return false;

    const description = smartTruncate((article.description || article.title || '').trim(), 3000);

    const caption = [
        '📰 *' + article.source + '* | ' + article.category,
        '',
        '📌 *' + article.title + '*',
        '',
        description,
        '',
        article.date ? '📅 ' + article.date : '',
        '🔗 ' + article.url,
        '',
        beautifulFooter()
    ].filter(line => line !== '').join('\n');

    try {
        let sent = null;
        let imageUrl = article.image || FALLBACK_IMAGE;
        
        // Try multiple Derana image URLs
        if (article.url && article.url.includes('sinhala.adaderana.lk')) {
            const id = article.url.split('/').pop();
            const deranaUrls = [
                `https://sinhala.adaderana.lk/news/featured-image/${id}`,
                `https://sinhala.adaderana.lk/images/news/${id}.jpg`,
                `https://sinhala.adaderana.lk/uploads/news/${id}.jpg`
            ];
            
            for (const url of deranaUrls) {
                try {
                    const test = await axios.head(url, { timeout: 5000 });
                    if (test.status === 200) {
                        imageUrl = url;
                        console.log(`📸 Found working Derana image: ${url}`);
                        break;
                    }
                } catch (e) {}
            }
        }
        
        // Try to send with image
        if (imageUrl && imageUrl.length > 10) {
            try {
                const imgResponse = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                        'Referer': 'https://sinhala.adaderana.lk/'
                    }
                });
                
                if (imgResponse.data && imgResponse.data.length > 1000) {
                    sent = await sock.sendMessage(jid, {
                        image: imgResponse.data,
                        caption: caption,
                        mimetype: 'image/jpeg'
                    });
                    console.log(`✅ News sent with image: ${imgResponse.data.length} bytes`);
                }
            } catch (e) {
                console.log(`⚠️ Image download failed: ${e.message}`);
            }
        }
        
        // If image failed, send with bot logo
        if (!sent) {
            console.log('📝 Sending news with bot logo');
            sent = await sock.sendMessage(jid, {
                image: { url: BOT_LOGO },
                caption: caption,
                mimetype: 'image/png'
            });
        }
        
        if (sent) {
            await sock.sendMessage(jid, {
                react: { text: randEmoji(REACTIONS), key: sent.key }
            });
            return true;
        }
        
        // Final fallback - text only
        sent = await sock.sendMessage(jid, { text: caption });
        return true;
        
    } catch (e) {
        console.error('❌ Send news error:', e.message);
        try {
            const sent = await sock.sendMessage(jid, { text: caption });
            return true;
        } catch (e2) {
            return false;
        }
    }
}

async function checkAndShareAllNewNewsToJid(jid) {
    if (!sock?.user) return;
    try { 
        const all = await fetchAllLatestNews(); 
        if (!all.length) { 
            await sock.sendMessage(jid,{text:'📭 No news available.'}); 
            return; 
        } 
        let s=0; 
        for (const i of all.slice(0,5)) { 
            if (await sendNewsToJid(jid,i)) { 
                s++; 
                await new Promise(r=>setTimeout(r,2000)); 
            } 
        } 
        await sock.sendMessage(jid,{text:`✅ ${s} news sent!`}); 
    } catch(e) {
        console.error('❌ checkAndShareAllNewNewsToJid error:', e.message);
    }
}

async function checkAndShareAllNewNews() {
    if (!sock?.user) return;
    if (await db.groupGet(NEWS_GROUP_JID,'isMuted',false)) return;
    try {
        const all = await fetchAllLatestNews(); 
        if (!all.length) return;
        const urls = await db.urlsGet();
        if (!urls.length) { 
            for (const i of all) { 
                if (i.url) await db.urlsAdd(i.url); 
            } 
            console.log(`🆕 ${all.length} news marked as sent`); 
            return; 
        }
        let s = 0;
        for (const i of all) { 
            if (!i.url||urls.includes(i.url)) continue; 
            if (await sendNewsToJid(NEWS_GROUP_JID,i)) { 
                await db.urlsAdd(i.url); 
                s++; 
            } 
            await new Promise(r=>setTimeout(r,3000)); 
        }
        console.log(s>0?`✅ ${s} new news sent`:'📭 No new news');
    } catch(e) {
        console.error('❌ News check failed:', e.message);
    }
}

// ============================================================
// 🎨 BEAUTIFUL MENU FUNCTIONS
// ============================================================

async function sendBeautifulMenu(sock, jid, db, isOwner, isAdmin, isGroup, prefix) {
    const mode = await db.get('botMode', 'public');
    const modeEmoji = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };

    const menuLines = [
        '╭' + '─'.repeat(40) + '╮',
        '┃       💝 *NEWS BOT LK* 💝       ┃',
        '┃   🦄 ✨ *Sri Lanka\'s #1* ✨ 🦄   ┃',
        '┃     *WhatsApp News Bot*        ┃',
        '┃     ' + modeEmoji[mode] + ' Mode: ' + mode.toUpperCase() + '              ┃',
        '╰' + '─'.repeat(40) + '╯',
        '',
        sectionDivider('📰 NEWS CENTER', '📡'),
        '  ✦ ' + prefix + 'news    ─ Fetch Latest News',
        '  ✦ ' + prefix + 'stats   ─ Bot Statistics',
        '',
        sectionDivider('💾 MEDIA STUDIO', '📦'),
        '  ✦ ' + prefix + 'save    ─ Save Media Files',
        '  ✦ ' + prefix + 'vv      ─ Save View-Once',
        '',
        sectionDivider('👥 GROUP TOOLS', '👑'),
        '  ✦ ' + prefix + 'admins    ─ List Admins',
        '  ✦ ' + prefix + 'groupinfo ─ Group Details',
        '  ✦ ' + prefix + 'tagall    ─ Mention All',
        '  ✦ ' + prefix + 'poll      ─ Create Poll',
        '  ✦ ' + prefix + 'afk       ─ Set AFK Status',
        ''
    ];

    if (isAdmin || isOwner) {
        menuLines.push(
            sectionDivider('🛡️ ADMIN PANEL', '⚔️'),
            '  ✦ ' + prefix + 'mute/unmute    ─ Toggle Mute',
            '  ✦ ' + prefix + 'warn @user     ─ Warn Member',
            '  ✦ ' + prefix + 'kick @user     ─ Remove Member',
            '  ✦ ' + prefix + 'add 94xxxxxxx  ─ Add Member',
            '  ✦ ' + prefix + 'promote @user  ─ Make Admin',
            '  ✦ ' + prefix + 'demote @user   ─ Remove Admin',
            '  ✦ ' + prefix + 'voice on/off   ─ Toggle Voice',
            '  ✦ ' + prefix + 'antilink on/off ─ Link Protection',
            ''
        );
    }

    if (isOwner) {
        menuLines.push(
            sectionDivider('👑 OWNER SUITE', '💎'),
            '  ✦ ' + prefix + 'settings        ─ All Settings',
            '  ✦ ' + prefix + 'mode public     ─ Bot Mode',
            '  ✦ ' + prefix + 'autonews on/off  ─ Auto News',
            '  ✦ ' + prefix + 'autostatus on/off ─ Auto Status',
            '  ✦ ' + prefix + 'ban @user       ─ Ban User',
            '  ✦ ' + prefix + 'unban @user     ─ Unban User',
            ''
        );
    }

    menuLines.push(
        '━'.repeat(40),
        '🌐 ' + (config.portfolio || 'https://charuka.lk'),
        '👨‍💻 ' + (config.developer || 'Charuka Mahesh'),
        '📦 Version: ' + (config.version || '9.0.0'),
        '🔧 Prefix: "' + prefix + '"',
        '',
        beautifulFooter()
    );

    const caption = menuLines.join('\n');
    
    try {
        const sent = await sock.sendMessage(jid, {
            image: { url: BOT_LOGO },
            caption: caption,
            mimetype: 'image/png'
        });
        await sock.sendMessage(jid, {
            react: { text: '📋', key: sent.key }
        });
    } catch (e) {
        const sent = await sock.sendMessage(jid, { text: caption });
        await sock.sendMessage(jid, {
            react: { text: '📋', key: sent.key }
        });
    }
}

async function sendBeautifulStats(sock, jid, db) {
    const settings = await db.all();
    const urlCount = await db.urlsCount();

    const txt = [
        '╭' + '─'.repeat(38) + '╮',
        '┃         📊 *STATISTICS*           ┃',
        '┃         💝 NewsBot LK 💝         ┃',
        '╰' + '─'.repeat(38) + '╯',
        '',
        sectionDivider('📊 OVERVIEW', '📈'),
        '  📰 News Shared: *' + urlCount + '*',
        '  📱 Status Saved: *' + fs.readdirSync(STATUS_FOLDER).length + '*',
        '  💾 Media Saved: *' + fs.readdirSync(SAVE_FOLDER).length + '*',
        '  🔄 Interval: *' + (CHECK_INTERVAL_MS / 1000) + 's*',
        '',
        sectionDivider('⚙️ STATUS', '📋'),
        '  📰 Auto News: ' + statusBadge(settings.autoNewsEnabled),
        '  🖤 Auto Status: ' + statusBadge(settings.autoStatusView),
        '  🎵 Voice: ' + statusBadge(settings.voiceReplyEnabled),
        '  📝 Auto Bio: ' + statusBadge(settings.autoBioEnabled),
        '',
        '🔧 Prefix: "' + (settings.prefix || '.') + '"',
        '',
        beautifulFooter()
    ].join('\n');

    try {
        const sent = await sock.sendMessage(jid, {
            image: { url: BOT_LOGO },
            caption: txt,
            mimetype: 'image/png'
        });
        await sock.sendMessage(jid, {
            react: { text: '📊', key: sent.key }
        });
    } catch (e) {
        const sent = await sock.sendMessage(jid, { text: txt });
        await sock.sendMessage(jid, {
            react: { text: '📊', key: sent.key }
        });
    }
}

async function sendBeautifulSettings(sock, jid, db, isOwner) {
    if (!isOwner) {
        await sock.sendMessage(jid, {
            text: '╭' + '─'.repeat(30) + '╮\n┃  ❌ *Owner Only!*  ┃\n╰' + '─'.repeat(30) + '╯' + beautifulFooter()
        });
        return;
    }

    const settings = await db.all();
    const bans = await db.banAll();
    const modeEmoji = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };

    const msg = [
        '╭' + '─'.repeat(38) + '╮',
        '┃         ⚙️ *BOT SETTINGS*         ┃',
        '┃         💝 NewsBot LK 💝         ┃',
        '╰' + '─'.repeat(38) + '╯',
        '',
        sectionDivider('📰 NEWS', '📡'),
        '  ▸ Auto News: ' + statusBadge(settings.autoNewsEnabled),
        '',
        sectionDivider('🖤 STATUS', '📱'),
        '  ▸ Auto Status View: ' + statusBadge(settings.autoStatusView),
        '  ▸ Auto Status React: ' + statusBadge(settings.autoStatusReact),
        '  ▸ Auto Status Save: ' + statusBadge(settings.autoStatusSave),
        '',
        sectionDivider('🔒 SECURITY', '🛡️'),
        '  ▸ Anti-Link: ' + statusBadge(settings.antiLinkEnabled),
        '',
        sectionDivider('🎵 VOICE', '🎤'),
        '  ▸ Voice Replies: ' + statusBadge(settings.voiceReplyEnabled),
        '',
        sectionDivider('📝 DISPLAY', '✨'),
        '  ▸ Auto Bio: ' + statusBadge(settings.autoBioEnabled),
        '',
        sectionDivider('👥 GROUP', '👑'),
        '  ▸ Welcome: ' + statusBadge(settings.welcomeEnabled),
        '  ▸ Goodbye: ' + statusBadge(settings.goodbyeEnabled),
        '',
        sectionDivider('🔧 SYSTEM', '⚙️'),
        '  ▸ Prefix: "' + (settings.prefix || '.') + '"',
        '  ▸ Mode: ' + (modeEmoji[settings.botMode] || '🌍') + ' ' + (settings.botMode || 'public').toUpperCase(),
        '  ▸ Banned: ' + bans.length,
        '  ▸ Version: v' + (config.version || '9.0.0'),
        '',
        beautifulFooter()
    ].join('\n');

    try {
        const sent = await sock.sendMessage(jid, {
            image: { url: BOT_LOGO },
            caption: msg,
            mimetype: 'image/png'
        });
        await sock.sendMessage(jid, {
            react: { text: '⚙️', key: sent.key }
        });
    } catch (e) {
        const sent = await sock.sendMessage(jid, { text: msg });
        await sock.sendMessage(jid, {
            react: { text: '⚙️', key: sent.key }
        });
    }
}

// ============================================================
// 💝 CONNECTED MESSAGE
// ============================================================
async function sendConnectedMessage() {
    if (!ownerJid || !sock) return;

    const botNumber = sock.user?.id?.split('@')[0] || 'Unknown';

    const msg = [
        '╔' + '═'.repeat(40) + '╗',
        '║     💝 *NEWS BOT LK* 💝        ║',
        '║  🦄 ✨ *Successfully* ✨ 🦄    ║',
        '║      *Connected!*             ║',
        '╚' + '═'.repeat(40) + '╝',
        '',
        '┌' + '─'.repeat(36) + '┐',
        '│  ✅ *Status:* Online          │',
        '│  🆔 *Bot ID:* ' + botNumber.padEnd(25) + '│',
        '│  🌍 *Mode:* PUBLIC            │',
        '│  🖤 *Auto Status:* ' + (await db.get('autoStatusView', true) ? 'ON ✅' : 'OFF ❌').padEnd(20) + '│',
        '│  🎵 *Voice:* ' + (await db.get('voiceReplyEnabled', true) ? 'ON ✅' : 'OFF ❌').padEnd(21) + '│',
        '│  📋 *.menu:* Show Menu        │',
        '│  ⚙️ *.settings:* Settings     │',
        '└' + '─'.repeat(36) + '┘',
        '',
        '📱 *Bot Number:* ' + botNumber,
        '👑 *Owner:* ' + OWNER_NUMBERS.join(', '),
        '',
        beautifulFooter()
    ].join('\n');

    try {
        await sock.sendMessage(ownerJid, {
            image: { url: BOT_LOGO },
            caption: msg,
            mimetype: 'image/png'
        });
        console.log(`💝 Connected message sent to owner`);
    } catch (e) {
        console.error('❌ Failed to send connected message:', e.message);
        try {
            await sock.sendMessage(ownerJid, { text: msg });
        } catch (e2) {}
    }
}

// ============================================================
// 🤖 MAIN BOT ENGINE
// ============================================================
async function startBot() {
    if (sock) {
        try { sock.end(); } catch {}
        sock = null;
    }

    const baileys = await import('@whiskeysockets/baileys');
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        Browsers
    } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(
        path.join(__dirname, 'auth_info_baileys')
    );

    sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS('Chrome'),
        markOnlineOnConnect: true,
        connectTimeoutMs: 30000,
        printQRInTerminal: false,
        syncFullHistory: false,
        retryRequestDelayMs: 5000,
        maxRetries: 5,
        defaultQueryTimeoutMs: 60000,
        generateHighQualityLinkPreview: false,
    });

    // ============================================================
    // 📨 MESSAGE HANDLER - ALL COMMANDS FIXED
    // ============================================================
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            try {
                if (!msg.message) continue;

                const jid = msg.key.remoteJid;

                // Status messages
                if (jid === 'status@broadcast') {
                    await handleStatus(msg);
                    continue;
                }

                // Get text
                let rawText = '';
                if (msg.message.conversation) rawText = msg.message.conversation;
                else if (msg.message.extendedTextMessage?.text) rawText = msg.message.extendedTextMessage.text;
                else if (msg.message.imageMessage?.caption) rawText = msg.message.imageMessage.caption;
                else if (msg.message.videoMessage?.caption) rawText = msg.message.videoMessage.caption;

                if (!rawText) continue;

                const text = rawText.trim();
                const lower = text.toLowerCase();
                const sender = msg.key.participant || jid;
                const senderNum = sender.split('@')[0].replace(/[^0-9]/g, '');
                const isUserOwner = isOwner(senderNum, sender);
                const isGroup = jid.endsWith('@g.us');
                const isAdmin = isGroup ? await checkAdmin(jid, sender) : false;
                const prefix = await db.get('prefix', '.');

                console.log(`📩 [${senderNum}] "${lower}" | Owner: ${isUserOwner}`);

                // Check ban
                if (await db.banCheck(sender) && !isUserOwner) {
                    console.log(`🚫 Banned: ${senderNum}`);
                    continue;
                }

                // ============================================================
                // 🎵 VOICE REPLIES (DM Only)
                // ============================================================
                if (!isGroup && await db.get('voiceReplyEnabled', true)) {
                    const voiceSent = await handleVoiceReply(jid, text, msg, isUserOwner);
                    if (voiceSent) continue;
                }

                // ============================================================
                // 📋 MENU
                // ============================================================
                if (lower === '.menu' || lower === `${prefix}menu` || lower === 'menu' || lower === 'help') {
                    console.log('✅ MENU triggered');
                    await sendBeautifulMenu(sock, jid, db, isUserOwner, isAdmin, isGroup, prefix);
                    continue;
                }

                // ============================================================
                // 📊 STATS
                // ============================================================
                if (lower === '.stats' || lower === `${prefix}stats` || lower === 'stats') {
                    console.log('✅ STATS triggered');
                    await sendBeautifulStats(sock, jid, db);
                    continue;
                }

                // ============================================================
                // 📰 NEWS
                // ============================================================
                if (lower === '.news' || lower === `${prefix}news` || lower === 'news') {
                    console.log('✅ NEWS triggered');
                    await sock.sendMessage(jid, {
                        text: '📰 *Fetching latest news...*\n⏳ Please wait...'
                    });
                    await checkAndShareAllNewNewsToJid(jid);
                    continue;
                }

                // ============================================================
                // ⚙️ SETTINGS (Owner Only)
                // ============================================================
                if (lower === '.settings' || lower === `${prefix}settings` || lower === 'settings') {
                    console.log('✅ SETTINGS triggered');
                    await sendBeautifulSettings(sock, jid, db, isUserOwner);
                    continue;
                }

                // ============================================================
                // 💾 SAVE - FIXED
                // ============================================================
                if (lower === '.save' || lower === `${prefix}save` || lower === '.ss' || lower === 'save') {
                    console.log('💾 Save triggered');
                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
                    
                    if (!quotedMsg) {
                        await sock.sendMessage(jid, { 
                            text: '💡 Reply to an image, video, or sticker with *' + prefix + 'save*'
                        });
                        continue;
                    }
                    
                    try {
                        const fakeMsg = {
                            key: { remoteJid: jid, id: quotedId || 'fake_' + Date.now() },
                            message: quotedMsg
                        };
                        const saved = await saveMediaToFile(fakeMsg);
                        if (saved) {
                            if (saved.type === 'imageMessage') {
                                await sock.sendMessage(jid, { image: saved.buffer, caption: '💾 *Saved!*\n📁 ' + saved.filename });
                            } else if (saved.type === 'videoMessage') {
                                await sock.sendMessage(jid, { video: saved.buffer, caption: '💾 *Saved!*\n📁 ' + saved.filename });
                            } else if (saved.type === 'stickerMessage') {
                                await sock.sendMessage(jid, { sticker: saved.buffer });
                                await sock.sendMessage(jid, { text: '💾 *Saved!*\n📁 ' + saved.filename });
                            } else {
                                await sock.sendMessage(jid, { document: saved.buffer, fileName: saved.filename, caption: '💾 *Saved!*\n📁 ' + saved.filename });
                            }
                        } else {
                            // Try URL fallback
                            const msgType = Object.keys(quotedMsg)[0];
                            let mediaUrl = null;
                            if (msgType === 'imageMessage' && quotedMsg.imageMessage?.url) mediaUrl = quotedMsg.imageMessage.url;
                            else if (msgType === 'videoMessage' && quotedMsg.videoMessage?.url) mediaUrl = quotedMsg.videoMessage.url;
                            else if (msgType === 'stickerMessage' && quotedMsg.stickerMessage?.url) mediaUrl = quotedMsg.stickerMessage.url;
                            
                            if (mediaUrl) {
                                const response = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 30000 });
                                if (response.data && response.data.length > 1000) {
                                    const ext = msgType === 'imageMessage' ? '.jpg' : msgType === 'videoMessage' ? '.mp4' : '.webp';
                                    const filename = `media_${Date.now()}${ext}`;
                                    fs.writeFileSync(path.join(SAVE_FOLDER, filename), Buffer.from(response.data));
                                    await sock.sendMessage(jid, { text: '💾 *Saved!*\n📁 ' + filename });
                                    continue;
                                }
                            }
                            await sock.sendMessage(jid, { text: '❌ *Failed to save!*' });
                        }
                    } catch (e) {
                        console.error('❌ Save error:', e.message);
                        await sock.sendMessage(jid, { text: '❌ *Error saving!*' });
                    }
                    continue;
                }

                // ============================================================
                // 👁️ VIEW-ONCE - FIXED
                // ============================================================
                if (lower === '.vv' || lower === `${prefix}vv` || lower === 'vv') {
                    console.log('👁️ VV triggered');
                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!quotedMsg) {
                        await sock.sendMessage(jid, { text: '💡 Reply to a view-once message with *' + prefix + 'vv*' });
                        continue;
                    }
                    const msgType = Object.keys(quotedMsg)[0];
                    if (!msgType?.includes('viewOnce')) {
                        await sock.sendMessage(jid, { text: '❌ Not a view-once message!' });
                        continue;
                    }
                    try {
                        let realMsg = quotedMsg;
                        if (msgType.includes('viewOnce')) {
                            const innerMsg = quotedMsg[msgType]?.message;
                            if (innerMsg) realMsg = innerMsg;
                        }
                        const fakeMsg = {
                            key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'vv_' + Date.now() },
                            message: realMsg
                        };
                        const saved = await saveMediaToFile(fakeMsg, VV_FOLDER);
                        if (saved && ownerJid) {
                            const cap = '📱 *VV Saved!*\n👤 @' + sender.split('@')[0];
                            if (saved.type === 'imageMessage') {
                                await sock.sendMessage(ownerJid, { image: saved.buffer, caption: cap, mentions: [sender] });
                            } else if (saved.type === 'videoMessage') {
                                await sock.sendMessage(ownerJid, { video: saved.buffer, caption: cap, mentions: [sender] });
                            }
                            await sock.sendMessage(jid, { text: '✅ *View-Once Saved!*' });
                        } else {
                            await sock.sendMessage(jid, { text: '❌ *Failed to save!*' });
                        }
                    } catch (e) {
                        console.error('❌ VV error:', e.message);
                        await sock.sendMessage(jid, { text: '❌ *Error saving!*' });
                    }
                    continue;
                }

                // ============================================================
                // 👥 GROUP COMMANDS
                // ============================================================
                if (isGroup) {
                    if (lower === '.admins' || lower === `${prefix}admins`) {
                        try {
                            const meta = await sock.groupMetadata(jid);
                            const admins = meta.participants.filter(p => p.admin);
                            await sock.sendMessage(jid, { 
                                text: '👑 *Admins*\n\n' + admins.map(p => '@' + p.id.split('@')[0]).join('\n'),
                                mentions: admins.map(p => p.id)
                            });
                        } catch (e) {}
                        continue;
                    }

                    if (lower === '.groupinfo' || lower === `${prefix}groupinfo` || lower === '.gcinfo') {
                        try {
                            const meta = await sock.groupMetadata(jid);
                            await sock.sendMessage(jid, { 
                                text: '📋 *Group Info*\n\n📛 ' + meta.subject + '\n👥 ' + meta.participants.length + ' members',
                                mentions: [meta.owner]
                            });
                        } catch (e) {}
                        continue;
                    }

                    if (lower === '.tagall' || lower === `${prefix}tagall` || lower === '.everyone') {
                        try {
                            const meta = await sock.groupMetadata(jid);
                            await sock.sendMessage(jid, { 
                                text: '📢 *Everyone!*',
                                mentions: meta.participants.map(p => p.id)
                            });
                        } catch (e) {}
                        continue;
                    }

                    if (lower.startsWith('.poll ') || lower.startsWith(`${prefix}poll `)) {
                        const question = text.replace('.poll', '').replace(`${prefix}poll`, '').trim();
                        await sock.sendMessage(jid, { 
                            poll: { 
                                name: '📊 ' + question, 
                                values: ['👍 Yes', '👎 No', '🤔 Maybe'], 
                                selectableCount: 1 
                            } 
                        });
                        continue;
                    }

                    if (lower.startsWith('.afk') || lower.startsWith(`${prefix}afk`)) {
                        const reason = text.replace('.afk', '').replace(`${prefix}afk`, '').trim() || 'AFK';
                        await db.afkSet(sender, reason);
                        await sock.sendMessage(jid, { 
                            text: '💤 @' + sender.split('@')[0] + ' *AFK:* ' + reason,
                            mentions: [sender]
                        });
                        continue;
                    }

                    // ============================================================
                    // 🛡️ ADMIN COMMANDS
                    // ============================================================
                    if (isAdmin || isUserOwner) {
                        if (lower === '.mute' || lower === `${prefix}mute`) {
                            await db.groupSet(jid, 'isMuted', true);
                            await sock.sendMessage(jid, { text: '🔇 *Muted for 30 minutes*' });
                            setTimeout(async () => { await db.groupSet(jid, 'isMuted', false); }, 30 * 60 * 1000);
                            continue;
                        }
                        if (lower === '.unmute' || lower === `${prefix}unmute`) {
                            await db.groupSet(jid, 'isMuted', false);
                            await sock.sendMessage(jid, { text: '🔊 *Unmuted!*' });
                            continue;
                        }
                        if (lower.startsWith('.warn ') || lower.startsWith(`${prefix}warn `)) {
                            const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                            if (mentioned?.length) {
                                const count = await db.warnAdd(mentioned[0], jid);
                                await sock.sendMessage(jid, { 
                                    text: '⚠️ *Warning @' + mentioned[0].split('@')[0] + '* (' + count + '/3)',
                                    mentions: [mentioned[0]]
                                });
                                if (count >= 3) {
                                    try {
                                        await sock.groupParticipantsUpdate(jid, [mentioned[0]], 'remove');
                                        await db.warnClear(mentioned[0], jid);
                                    } catch (e) {}
                                }
                            }
                            continue;
                        }
                        if (lower.startsWith('.kick ') || lower.startsWith(`${prefix}kick `)) {
                            const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                            if (mentioned?.length) {
                                try {
                                    await sock.groupParticipantsUpdate(jid, [mentioned[0]], 'remove');
                                    await sock.sendMessage(jid, { text: '🚫 *Kicked!*' });
                                } catch (e) {}
                            }
                            continue;
                        }
                        if (lower.startsWith('.add ') || lower.startsWith(`${prefix}add `)) {
                            const num = text.replace('.add', '').replace(`${prefix}add`, '').trim().replace(/[^0-9]/g, '');
                            if (num) {
                                try {
                                    await sock.groupParticipantsUpdate(jid, [num + '@s.whatsapp.net'], 'add');
                                    await sock.sendMessage(jid, { text: '✅ *Added +' + num + '!*' });
                                } catch (e) {}
                            }
                            continue;
                        }
                        if (lower.startsWith('.promote ') || lower.startsWith(`${prefix}promote `)) {
                            const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                            if (mentioned?.length) {
                                try {
                                    await sock.groupParticipantsUpdate(jid, [mentioned[0]], 'promote');
                                    await sock.sendMessage(jid, { text: '👑 *Promoted!*' });
                                } catch (e) {}
                            }
                            continue;
                        }
                        if (lower.startsWith('.demote ') || lower.startsWith(`${prefix}demote `)) {
                            const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                            if (mentioned?.length) {
                                try {
                                    await sock.groupParticipantsUpdate(jid, [mentioned[0]], 'demote');
                                    await sock.sendMessage(jid, { text: '⬇️ *Demoted!*' });
                                } catch (e) {}
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
                    if (lower === '.mode' || lower.startsWith('.mode ') || lower === `${prefix}mode` || lower.startsWith(`${prefix}mode `)) {
                        const modeArg = text.replace('.mode', '').replace(`${prefix}mode`, '').trim().toLowerCase();
                        const validModes = ['private', 'inbox', 'groups', 'public'];
                        const modeEmoji = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };
                        if (validModes.includes(modeArg)) {
                            await db.set('botMode', modeArg);
                            await sock.sendMessage(jid, { text: modeEmoji[modeArg] + ' *Mode: ' + modeArg.toUpperCase() + '*' });
                        } else {
                            const currentMode = await db.get('botMode', 'public');
                            await sock.sendMessage(jid, { text: modeEmoji[currentMode] + ' *Current: ' + currentMode.toUpperCase() + '*\n💡 .mode private/inbox/groups/public' });
                        }
                        continue;
                    }

                    if (lower === '.autonews on') { await db.set('autoNewsEnabled', true); await sock.sendMessage(jid, { text: '📰 *Auto News: ON*' }); continue; }
                    if (lower === '.autonews off') { await db.set('autoNewsEnabled', false); await sock.sendMessage(jid, { text: '📰 *Auto News: OFF*' }); continue; }

                    if (lower === '.autostatus on') {
                        await db.set('autoStatusView', true);
                        await db.set('autoStatusReact', true);
                        await db.set('autoStatusSave', true);
                        await sock.sendMessage(jid, { text: '🖤 *Auto Status: ON*\n✅ View, React & Save enabled' });
                        continue;
                    }
                    if (lower === '.autostatus off') {
                        await db.set('autoStatusView', false);
                        await db.set('autoStatusReact', false);
                        await db.set('autoStatusSave', false);
                        await sock.sendMessage(jid, { text: '🖤 *Auto Status: OFF*' });
                        continue;
                    }

                    if (lower.startsWith('.ban ') || lower.startsWith(`${prefix}ban `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            await db.banAdd(mentioned[0]);
                            await sock.sendMessage(jid, { text: '🚫 @' + mentioned[0].split('@')[0] + ' *banned!*', mentions: [mentioned[0]] });
                        }
                        continue;
                    }
                    if (lower.startsWith('.unban ') || lower.startsWith(`${prefix}unban `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            await db.banRemove(mentioned[0]);
                            await sock.sendMessage(jid, { text: '✅ @' + mentioned[0].split('@')[0] + ' *unbanned!*', mentions: [mentioned[0]] });
                        }
                        continue;
                    }
                    if (lower === '.banlist') {
                        const bans = await db.banAll();
                        if (!bans.length) {
                            await sock.sendMessage(jid, { text: '✅ *No bans!*' });
                        } else {
                            const list = bans.map((b, i) => (i + 1) + '. @' + b.userId.split('@')[0]).join('\n');
                            await sock.sendMessage(jid, { text: '🚫 *Banned (' + bans.length + ')*\n' + list, mentions: bans.map(b => b.userId) });
                        }
                        continue;
                    }

                    if (lower.startsWith('.setprefix ') || lower.startsWith(`${prefix}setprefix `)) {
                        const newPrefix = text.replace('.setprefix', '').replace(`${prefix}setprefix`, '').trim();
                        if (newPrefix.length >= 1 && newPrefix.length <= 3) {
                            await db.set('prefix', newPrefix);
                            await sock.sendMessage(jid, { text: '🔧 *Prefix: "' + newPrefix + '"*\n💡 Use *' + newPrefix + 'menu*' });
                        }
                        continue;
                    }

                    if (lower.startsWith('.broadcast ') || lower.startsWith(`${prefix}broadcast `)) {
                        const broadcastMsg = text.replace('.broadcast', '').replace(`${prefix}broadcast`, '').trim();
                        try {
                            const groups = await sock.groupFetchAllParticipating();
                            let count = 0;
                            for (const gid of Object.keys(groups)) {
                                try {
                                    await sock.sendMessage(gid, { text: '📢 *Broadcast*\n\n' + broadcastMsg });
                                    count++;
                                    await new Promise(r => setTimeout(r, 1000));
                                } catch (e) {}
                            }
                            await sock.sendMessage(jid, { text: '📢 *Sent to ' + count + ' groups!*' });
                        } catch (e) {}
                        continue;
                    }
                }

                // ============================================================
                // 🔗 ANTI-LINK
                // ============================================================
                if (isGroup && await db.get('antiLinkEnabled', false) && !isAdmin && !isUserOwner) {
                    const linkRegex = /https?:\/\/(?:chat\.whatsapp\.com|t\.me|discord\.gg|instagram\.com|facebook\.com)/i;
                    if (linkRegex.test(text)) {
                        try { await sock.sendMessage(jid, { delete: msg.key }); } catch (e) {}
                        await sock.sendMessage(jid, { text: '🔗 *Link Deleted!*\n👤 @' + sender.split('@')[0], mentions: [sender] });
                        continue;
                    }
                }

                // ============================================================
                // 💤 AFK DETECTION
                // ============================================================
                if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                    for (const mentioned of msg.message.extendedTextMessage.contextInfo.mentionedJid) {
                        const afk = await db.afkGet(mentioned);
                        if (afk) {
                            const mins = Math.floor((Date.now() - new Date(afk.afkAt).getTime()) / 60000);
                            await sock.sendMessage(jid, { text: '💤 @' + mentioned.split('@')[0] + ' *AFK:* ' + afk.reason + ' (' + mins + 'm)', mentions: [mentioned] });
                        }
                    }
                }

                if (await db.afkGet(sender) && !lower.startsWith('.afk') && !lower.startsWith(`${prefix}afk`)) {
                    await db.afkRemove(sender);
                }

            } catch (e) {
                console.error('❌ Message handler error:', e.message);
            }
        }
    });

    // ============================================================
    // 👥 GROUP PARTICIPANT UPDATES
    // ============================================================
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (action === 'add' && await db.get('welcomeEnabled', false)) {
            for (const p of participants) {
                await sock.sendMessage(id, { 
                    text: '🎉 *Welcome!*\n\n👋 @' + p.split('@')[0],
                    mentions: [p]
                });
            }
        }
        if (action === 'remove' && await db.get('goodbyeEnabled', false)) {
            for (const p of participants) {
                await sock.sendMessage(id, { 
                    text: '😢 *Goodbye!*\n\n👋 @' + p.split('@')[0],
                    mentions: [p]
                });
            }
        }
    });

    // ============================================================
    // 🔌 CONNECTION UPDATES
    // ============================================================
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('\n📱 Scan QR Code:\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            isConnected = false;
            sock = null;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut && !isShuttingDown) {
                reconnectAttempts++;
                const delay = Math.min(10000, 2000 * reconnectAttempts);
                console.log(`\n🔄 Reconnecting in ${delay/1000}s... (Attempt ${reconnectAttempts})\n`);
                reconnectTimer = setTimeout(async () => {
                    reconnectTimer = null;
                    if (!isShuttingDown) await startBot();
                }, delay);
            }
        } else if (connection === 'open') {
            isConnected = true;
            reconnectAttempts = 0;

            if (sock.user) {
                ownerJid = sock.user.id.replace(/:.*/, '') + '@s.whatsapp.net';
            }

            console.log('\n' + '═'.repeat(50));
            console.log('  💝 NewsBot LK - Connected! 💝');
            console.log('═'.repeat(50));
            console.log(`  👑 Owner: ${OWNER_NUMBERS.join(', ')}`);
            console.log(`  🆔 Bot ID: ${sock.user?.id || 'Unknown'}`);
            console.log(`  🦄 v${config.version || '9.0.0'}`);
            console.log(`  🌍 Mode: PUBLIC - Everyone can use!`);
            console.log(`  🎵 Voice Replies: ${Object.keys(voiceReplies.replies || {}).length} triggers loaded`);
            console.log('═'.repeat(50) + '\n');

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
    console.log('\n' + '═'.repeat(50));
    console.log('  💝 NewsBot LK v' + (config.version || '9.0.0') + ' 💝');
    console.log('═'.repeat(50));
    console.log('  👨‍💻 ' + (config.developer || 'Charuka Mahesh'));
    console.log('  👑 Owners: ' + OWNER_NUMBERS.join(', '));
    console.log('═'.repeat(50));
    console.log('  💝 Dedicated to:');
    console.log('  🌸 Umesha Sathyanjali');
    console.log('  🌸 Mithila');
    console.log('  🌸 Sharada');
    console.log('═'.repeat(50) + '\n');

    await connectDatabase();
    await db.set('botMode', 'public');
    console.log('🌍 Bot mode: PUBLIC - Everyone can use!');
    console.log(`🎵 Voice replies: ${Object.keys(voiceReplies.replies || {}).length} triggers ready`);
    console.log('🔇 Voice replies DISABLED for owner');
    console.log('🔓 ALL RESTRICTIONS REMOVED\n');

    await startBot();

    setInterval(async () => {
        if (await db.get('autoNewsEnabled', true)) {
            await checkAndShareAllNewNews();
        }
    }, CHECK_INTERVAL_MS);

    console.log('🦄💝 NewsBot LK is running in PUBLIC MODE! 💝🦄\n');
})();

// ============================================================
// 💝 END OF CODE - Made with ❤️ by Charuka Mahesh 💝
// ============================================================
