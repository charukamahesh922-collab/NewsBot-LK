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
const voiceClips = require('./voiceReplies');

const dynews = new DY_NEWS();

// ============================================================
// 🧹 CLEANUP
// ============================================================
try {
    if (fs.existsSync(path.join(__dirname, 'app.pid'))) {
        fs.unlinkSync(path.join(__dirname, 'app.pid'));
    }
} catch (e) {}

console.log('🧹 Cleanup complete');

// ============================================================
// ⚙️ CONFIGURATION
// ============================================================
const OWNER_NUMBERS = Array.isArray(config.ownerNumber) 
    ? config.ownerNumber 
    : [config.ownerNumber];

const NEWS_GROUP_JID = config.newsGroupJid;
const CHECK_INTERVAL_MS = config.checkIntervalMs;
const BOT_LOGO = config.botLogo;
const FALLBACK_IMAGE = config.fallbackImage;
const REACTIONS = config.reactions;

const SAVE_FOLDER = path.join(__dirname, 'saved_media');
const STATUS_FOLDER = path.join(__dirname, 'saved_status');
const VV_FOLDER = path.join(__dirname, 'view_once_saved');
const TEST_MODE = true;

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
    settings: {},
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
                settings: {},
                warnings: {},
                bans: [],
                afk: {},
                groupSettings: {},
                sentUrls: [],
                ...data
            };
        }
    } catch (e) {
        console.error('❌ JSON DB Load Error:', e.message);
    }
}

function saveJsonDb() {
    try {
        fs.writeFileSync(JSON_DB_FILE, JSON.stringify(jsonDb, null, 2));
    } catch (e) {
        console.error('❌ JSON DB Save Error:', e.message);
    }
}

// ============================================================
// 🍃 MONGOOSE SCHEMAS
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

let Setting, Warning, Ban, Afk, GroupSetting;

// ============================================================
// 🔌 DATABASE CONNECTION
// ============================================================
async function connectDatabase() {
    // Check if MongoDB is disabled
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
                dbName: config.dbName,
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                ssl: false,
                tls: false,
                retryWrites: false
            });

            // Initialize models
            Setting = mongoose.model('Setting', settingSchema);
            Warning = mongoose.model('Warning', warningSchema);
            Ban = mongoose.model('Ban', banSchema);
            Afk = mongoose.model('Afk', afkSchema);
            GroupSetting = mongoose.model('GroupSetting', groupSettingSchema);

            // Initialize default settings if empty
            if (await Setting.countDocuments() === 0) {
                for (const [key, value] of Object.entries(config.defaults)) {
                    await Setting.create({ key, value });
                }
            }

            console.log('✅ Mongoose Connected');
            return true;

        } catch (error) {
            console.error('❌ MongoDB Connection Failed:', error.message);
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }
        }
    }

    // Fallback to JSON if all MongoDB URLs fail
    useJsonFallback = true;
    loadJsonDb();
    console.log('⚠️ Falling back to JSON Database');
    return false;
}

// ============================================================
// 🗃️ DATABASE OPERATIONS
// ============================================================
const db = {
    // Check if using JSON fallback
    isJson: () => useJsonFallback,

    // Get a setting
    get: async (key, defaultValue) => {
        if (useJsonFallback) {
            return jsonDb.settings[key] ?? config.defaults[key] ?? defaultValue;
        }
        try {
            const record = await Setting.findOne({ key });
            return record ? record.value : (config.defaults[key] ?? defaultValue);
        } catch {
            return config.defaults[key] ?? defaultValue;
        }
    },

    // Set a setting
    set: async (key, value) => {
        console.log(`💾 DB: ${key} = ${value}`);
        if (useJsonFallback) {
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

    // Get all settings
    all: async () => {
        if (useJsonFallback) {
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

    // Warning system
    warnAdd: async (userId, groupId) => {
        if (useJsonFallback) {
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
        if (useJsonFallback) {
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

    // Ban system
    banAdd: async (userId, reason = '') => {
        if (useJsonFallback) {
            if (!jsonDb.bans.find(b => b.userId === userId)) {
                jsonDb.bans.push({
                    userId,
                    reason,
                    bannedAt: new Date().toISOString()
                });
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
        if (useJsonFallback) {
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
        if (useJsonFallback) {
            return jsonDb.bans.some(b => b.userId === userId);
        }
        try {
            return !!(await Ban.findOne({ userId }));
        } catch {
            return false;
        }
    },

    banAll: async () => {
        if (useJsonFallback) return jsonDb.bans;
        try {
            return await Ban.find({});
        } catch {
            return [];
        }
    },

    // AFK system
    afkSet: async (userId, reason) => {
        if (useJsonFallback) {
            jsonDb.afk[userId] = {
                userId,
                reason,
                afkAt: new Date().toISOString()
            };
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
        if (useJsonFallback) {
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
        if (useJsonFallback) return jsonDb.afk[userId] || null;
        try {
            return await Afk.findOne({ userId });
        } catch {
            return null;
        }
    },

    // Group settings
    groupGet: async (groupId, key, defaultValue) => {
        if (useJsonFallback) {
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
        if (useJsonFallback) {
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

    // URL tracking for news
    urlsGet: async () => {
        if (useJsonFallback) return jsonDb.sentUrls || [];
        try {
            const doc = await Setting.findOne({ key: 'sentUrls' });
            return doc?.value || [];
        } catch {
            return [];
        }
    },

    urlsAdd: async (url) => {
        if (useJsonFallback) {
            if (!jsonDb.sentUrls.includes(url)) {
                jsonDb.sentUrls.push(url);
                saveJsonDb();
            }
            return true;
        }
        try {
            await Setting.updateOne(
                { key: 'sentUrls' },
                { $addToSet: { value: url } },
                { upsert: true }
            );
            return true;
        } catch {
            return false;
        }
    },

    urlsCount: async () => {
        if (useJsonFallback) return jsonDb.sentUrls.length;
        try {
            const doc = await Setting.findOne({ key: 'sentUrls' });
            return doc?.value?.length || 0;
        } catch {
            return 0;
        }
    }
};

// ============================================================
// 🎨 BEAUTIFUL UI SYSTEM
// ============================================================

/**
 * 💝 Beautiful Footer
 * Appears on ALL bot messages
 */
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

/**
 * 💝 Beautiful Header
 * Used for menus and info displays
 */
const beautifulHeader = () => {
    return [
        '╭' + '─'.repeat(38) + '╮',
        '┃     💝 *NewsBot LK* 💝     ┃',
        '┃  🦄 ✨ *Sri Lanka\'s #1* ✨ 🦄  ┃',
        '┃    *WhatsApp News Bot*     ┃',
        '╰' + '─'.repeat(38) + '╯'
    ].join('\n');
};

/**
 * 💝 Section Divider
 * @param {string} title - Section title
 * @param {string} emoji - Emoji for the section
 */
const sectionDivider = (title, emoji) => {
    const line = '─'.repeat(8);
    return `\n${emoji} ${line} *${title}* ${line} ${emoji}\n`;
};

/**
 * 💝 Status Badge
 * Shows ON/OFF status with emoji
 */
const statusBadge = (enabled) => {
    return enabled ? '✅ *ON*' : '❌ *OFF*';
};

// ============================================================
// 🧹 TEXT UTILITIES
// ============================================================

/**
 * Clean HTML text
 */
const cleanText = (text) => {
    if (!text) return '';
    return text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&zwj;/gi, '')
        .replace(/&zwnj;/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Smart text truncation
 */
const truncate = (text, maxLength = 5000) => {
    if (!text || text.length <= maxLength) return text;
    
    const shortened = text.substring(0, maxLength);
    const breakPoints = [
        shortened.lastIndexOf('. '),
        shortened.lastIndexOf('? '),
        shortened.lastIndexOf('! '),
        shortened.lastIndexOf('\n')
    ].filter(pos => pos > maxLength * 0.6);

    if (breakPoints.length) {
        return shortened.substring(0, Math.max(...breakPoints) + 1).trim();
    }

    const lastSpace = shortened.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
        return shortened.substring(0, lastSpace).trim() + '...';
    }
    return shortened.trim() + '...';
};

/**
 * Get random emoji from array
 */
const randEmoji = (array) => {
    return array[Math.floor(Math.random() * array.length)];
};

// ============================================================
// 🔐 AUTHENTICATION & PERMISSIONS
// ============================================================
let sock = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let isConnected = false;
let isShuttingDown = false;
let lastStatusTime = 0;
let ownerJid = null;

/**
 * Check if sender is bot owner
 */
function isOwner(senderNumber, senderJid) {
    const cleanNumber = senderNumber.replace(/[^0-9]/g, '');
    
    // Check against configured owner numbers
    if (OWNER_NUMBERS.some(num => num.replace(/[^0-9]/g, '') === cleanNumber)) {
        return true;
    }
    
    // Check against connected JID
    if (ownerJid && senderJid === ownerJid) return true;
    if (ownerJid && ownerJid.split('@')[0].replace(/[^0-9]/g, '') === cleanNumber) return true;
    
    return false;
}

/**
 * Check if user can use bot based on mode
 */
async function canUseBot(jid, isUserOwner) {
    if (isUserOwner) return true;
    
    const mode = await db.get('botMode', 'public');
    const isGroup = jid.endsWith('@g.us');
    
    switch (mode) {
        case 'private': return false;
        case 'inbox': return !isGroup;
        case 'groups': return isGroup;
        default: return true;
    }
}

/**
 * Check if sender is group admin
 */
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
// 📥 MEDIA HANDLERS
// ============================================================

/**
 * Download media from message
 */
async function downloadMedia(msg) {
    try {
        const baileys = await import('@whiskeysockets/baileys');
        return await baileys.downloadMediaMessage(
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
    } catch {
        return null;
    }
}

/**
 * Save media to file
 */
async function saveMediaToFile(msg, folder = SAVE_FOLDER) {
    try {
        let realMessage = msg;
        let messageType = Object.keys(msg.message || {})[0];

        // Handle view once messages
        if (messageType?.includes('viewOnce')) {
            const innerMessage = msg.message[messageType]?.message;
            if (innerMessage) {
                realMessage = { ...msg, message: innerMessage };
                messageType = Object.keys(innerMessage)[0];
            }
        }

        // Map message types to file extensions
        const extensionMap = {
            imageMessage: '.jpg',
            videoMessage: '.mp4',
            audioMessage: '.ogg',
            stickerMessage: '.webp'
        };

        const extension = extensionMap[messageType];
        if (!extension) return null;

        const buffer = await downloadMedia(realMessage);
        if (!buffer || buffer.length < 100) return null;

        const filename = `media_${Date.now()}${extension}`;
        fs.writeFileSync(path.join(folder, filename), buffer);

        return {
            buffer,
            type: messageType,
            ext: extension,
            filename
        };
    } catch {
        return null;
    }
}

/**
 * Update bot bio/profile status
 */
async function updateBotBio() {
    if (!sock || !isConnected) return;
    if (!await db.get('autoBioEnabled', true)) return;

    try {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const bio = [
            `💝 ${config.botName} | Auto Mode`,
            `📅 ${dateStr}`,
            `⏰ ${timeStr}`,
            `🦄 Powered by Charuka Mahesh`
        ].join('\n');

        await sock.updateProfileStatus(bio);
    } catch (e) {
        // Silent fail
    }
}

/**
 * Handle WhatsApp status updates
 */
async function handleStatus(msg) {
    if (!sock) return;

    try {
        const { key } = msg;
        if (key.fromMe) return;

        const participant = key.participant || key.remoteJid;
        if (!participant || participant === sock.user?.id) return;

        // Rate limit status handling
        if (Date.now() - lastStatusTime < 3000) return;
        lastStatusTime = Date.now();

        // Anti view-once check
        if (
            await db.get('antiViewOnce', false) &&
            (msg.message?.imageMessage?.viewOnce || msg.message?.videoMessage?.viewOnce)
        ) return;

        // Auto view status
        if (!await db.get('autoStatusView', true)) return;
        await sock.readMessages([key]);

        // Auto react to status
        if (await db.get('autoStatusReact', true)) {
            const emoji = randEmoji(config.statusEmojis);
            try {
                await sock.sendMessage('status@broadcast', {
                    react: { text: emoji, key }
                });
            } catch (e) {
                // Silent fail
            }
        }
    } catch (e) {
        // Silent fail
    }
}

// ============================================================
// 🎨 BEAUTIFUL MENU DISPLAYS
// ============================================================

/**
 * 💝 Send Beautiful Full Menu
 */
async function sendBeautifulMenu(sock, jid, db, config, owner, admin, isGroup, prefix) {
    const mode = await db.get('botMode', 'public');
    const modeEmoji = {
        private: '🔒',
        inbox: '📥',
        groups: '👥',
        public: '🌍'
    };

    const menuLines = [
        // Header
        '╭' + '─'.repeat(40) + '╮',
        '┃       💝 *NewsBot LK* 💝       ┃',
        '┃   🦄 ✨ *Sri Lanka\'s #1* ✨ 🦄   ┃',
        '┃     *WhatsApp News Bot*        ┃',
        '┃     ' + modeEmoji[mode] + ' Mode: ' + mode.toUpperCase() + '              ┃',
        '╰' + '─'.repeat(40) + '╯',
        
        // News Section
        '',
        sectionDivider('📰 NEWS CENTER', '📡'),
        '  ✦ ' + prefix + 'news    ─ Fetch Latest News',
        '  ✦ ' + prefix + 'stats   ─ Bot Statistics',
        
        // Media Section
        '',
        sectionDivider('💾 MEDIA STUDIO', '📦'),
        '  ✦ ' + prefix + 'save    ─ Save Media Files',
        '  ✦ ' + prefix + 'vv      ─ Save View-Once',
        '  ✦ ' + prefix + 'status  ─ Status Info',
        
        // Group Section
        '',
        sectionDivider('👥 GROUP TOOLS', '👑'),
        '  ✦ ' + prefix + 'admins    ─ List Admins',
        '  ✦ ' + prefix + 'groupinfo ─ Group Details',
        '  ✦ ' + prefix + 'tagall    ─ Mention All',
        '  ✦ ' + prefix + 'poll      ─ Create Poll',
        '  ✦ ' + prefix + 'afk       ─ Set AFK Status',
        ''
    ];

    // Admin Commands
    if (admin || owner) {
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
            '  ✦ ' + prefix + 'welcome on/off  ─ Welcome Msg',
            '  ✦ ' + prefix + 'goodbye on/off  ─ Goodbye Msg',
            '  ✦ ' + prefix + 'buttons on/off  ─ Button Menu',
            ''
        );
    }

    // Owner Commands
    if (owner) {
        menuLines.push(
            sectionDivider('👑 OWNER SUITE', '💎'),
            '  ✦ ' + prefix + 'settings        ─ All Settings',
            '  ✦ ' + prefix + 'mode public     ─ Bot Mode',
            '  ✦ ' + prefix + 'autostatus on/off ─ Auto Status',
            '  ✦ ' + prefix + 'autonews on/off  ─ Auto News',
            '  ✦ ' + prefix + 'autobio on/off   ─ Auto Bio',
            '  ✦ ' + prefix + 'setprefix !     ─ Change Prefix',
            '  ✦ ' + prefix + 'broadcast msg   ─ Mass Message',
            '  ✦ ' + prefix + 'ban @user       ─ Ban User',
            '  ✦ ' + prefix + 'unban @user     ─ Unban User',
            '  ✦ ' + prefix + 'banlist         ─ Banned List',
            ''
        );
    }

    // Voice Commands & Footer
    menuLines.push(
        sectionDivider('🎵 VOICE COMMANDS (DM)', '🎤'),
        '  gm ✦ gn ✦ hi ✦ ily ✦ bye',
        '  sad ✦ happy ✦ cry ✦ love',
        '  ...50+ emotional triggers!',
        '',
        '━'.repeat(40),
        '🌐 ' + config.portfolio,
        '👨‍💻 ' + config.developer,
        '📦 Version: ' + config.version,
        '🔧 Prefix: "' + prefix + '"',
        '',
        beautifulFooter()
    );

    const caption = menuLines.join('\n');
    const sent = await sock.sendMessage(jid, {
        image: { url: BOT_LOGO },
        caption: caption,
        mimetype: 'image/png'
    });
    await sock.sendMessage(jid, {
        react: { text: '📋', key: sent.key }
    });
}

/**
 * 💝 Send Beautiful Settings Panel
 */
async function sendBeautifulSettings(sock, jid, db, isOwner, config) {
    if (!isOwner) {
        await sock.sendMessage(jid, {
            text: '╭' + '─'.repeat(30) + '╮\n┃  ❌ *Owner Only!*  ┃\n╰' + '─'.repeat(30) + '╯' + beautifulFooter()
        });
        return;
    }

    const settings = await db.all();
    const bans = await db.banAll();
    const modeEmoji = {
        private: '🔒',
        inbox: '📥',
        groups: '👥',
        public: '🌍'
    };

    const msg = [
        // Header
        '╭' + '─'.repeat(38) + '╮',
        '┃         ⚙️ *Bot Settings*         ┃',
        '┃         💝 NewsBot LK 💝         ┃',
        '╰' + '─'.repeat(38) + '╯',
        
        // News
        '',
        sectionDivider('📰 NEWS', '📡'),
        '  ▸ Auto News: ' + statusBadge(settings.autoNewsEnabled),
        
        // Status
        '',
        sectionDivider('🖤 STATUS', '📱'),
        '  ▸ Auto View: ' + statusBadge(settings.autoStatusView),
        '  ▸ Auto React: ' + statusBadge(settings.autoStatusReact),
        
        // Security
        '',
        sectionDivider('🔒 SECURITY', '🛡️'),
        '  ▸ Anti-Link: ' + statusBadge(settings.antiLinkEnabled),
        '  ▸ Anti VV: ' + statusBadge(settings.antiViewOnce),
        
        // Voice
        '',
        sectionDivider('🎵 VOICE', '🎤'),
        '  ▸ Voice Replies: ' + statusBadge(settings.voiceReplyEnabled),
        
        // Display
        '',
        sectionDivider('📝 DISPLAY', '✨'),
        '  ▸ Auto Bio: ' + statusBadge(settings.autoBioEnabled),
        '  ▸ Button Menu: ' + statusBadge(settings.buttonMenuEnabled),
        
        // Group
        '',
        sectionDivider('👥 GROUP', '👑'),
        '  ▸ Welcome: ' + statusBadge(settings.welcomeEnabled),
        '  ▸ Goodbye: ' + statusBadge(settings.goodbyeEnabled),
        
        // System
        '',
        sectionDivider('🔧 SYSTEM', '⚙️'),
        '  ▸ Prefix: "' + (settings.prefix || '.') + '"',
        '  ▸ Mode: ' + (modeEmoji[settings.botMode] || '🌍') + ' ' + (settings.botMode || 'public').toUpperCase(),
        '  ▸ Banned: ' + bans.length,
        '  ▸ Version: v' + config.version,
        '',
        beautifulFooter()
    ].join('\n');

    const sent = await sock.sendMessage(jid, {
        image: { url: BOT_LOGO },
        caption: msg,
        mimetype: 'image/png'
    });
    await sock.sendMessage(jid, {
        react: { text: '⚙️', key: sent.key }
    });
}

/**
 * 💝 Send Beautiful Stats
 */
async function sendBeautifulStats(sock, jid, db, config) {
    const settings = await db.all();
    const urlCount = await db.urlsCount();

    const txt = [
        // Header
        '╭' + '─'.repeat(38) + '╮',
        '┃         📊 *Statistics*           ┃',
        '┃         💝 NewsBot LK 💝         ┃',
        '╰' + '─'.repeat(38) + '╯',
        
        // Overview
        '',
        sectionDivider('📊 OVERVIEW', '📈'),
        '  📰 News Shared: *' + urlCount + '*',
        '  📱 Status Saved: *' + fs.readdirSync(STATUS_FOLDER).length + '*',
        '  💾 Media Saved: *' + fs.readdirSync(SAVE_FOLDER).length + '*',
        '  🔄 Interval: *' + (CHECK_INTERVAL_MS / 1000) + 's*',
        
        // Status
        '',
        sectionDivider('⚙️ STATUS', '📋'),
        '  📰 Auto News: ' + statusBadge(settings.autoNewsEnabled),
        '  🖤 Status React: ' + statusBadge(settings.autoStatusReact),
        '  🎵 Voice: ' + statusBadge(settings.voiceReplyEnabled),
        '  📝 Auto Bio: ' + statusBadge(settings.autoBioEnabled),
        '',
        '🔧 Prefix: "' + (settings.prefix || '.') + '"',
        '',
        beautifulFooter()
    ].join('\n');

    const sent = await sock.sendMessage(jid, { text: txt });
    await sock.sendMessage(jid, {
        react: { text: '📊', key: sent.key }
    });
}

// ============================================================
// 🤖 MAIN BOT ENGINE
// ============================================================
async function startBot() {
    // Clean up existing connection
    if (sock) {
        try { sock.end(); } catch {}
        sock = null;
    }

    // Import Baileys
    const baileys = await import('@whiskeysockets/baileys');
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason
    } = baileys;

    // Load auth state
    const { state, saveCreds } = await useMultiFileAuthState(
        path.join(__dirname, 'auth_info_baileys')
    );

    // Create socket
    sock = makeWASocket({
        auth: state,
        browser: [config.botName, 'Chrome', config.version],
        connectTimeoutMs: 30000,
        printQRInTerminal: false
    });

    // ============================================================
    // 📨 MESSAGE HANDLER
    // ============================================================
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            // Skip empty messages
            if (!msg.message) continue;

            const jid = msg.key.remoteJid;

            // Handle status messages
            if (jid === 'status@broadcast') {
                await handleStatus(msg);
                continue;
            }

            // Skip own messages in production
            if (msg.key.fromMe && !TEST_MODE) continue;

            // Get message text
            let rawText = '';
            if (msg.message.conversation) {
                rawText = msg.message.conversation;
            } else if (msg.message.extendedTextMessage?.text) {
                rawText = msg.message.extendedTextMessage.text;
            } else if (msg.message.imageMessage?.caption) {
                rawText = msg.message.imageMessage.caption;
            } else if (msg.message.videoMessage?.caption) {
                rawText = msg.message.videoMessage.caption;
            }

            if (!rawText) continue;

            // Parse message
            const text = rawText.trim();
            const lower = text.toLowerCase();
            const sender = msg.key.participant || jid;
            const senderNum = sender.split('@')[0].replace(/[^0-9]/g, '');
            const isUserOwner = isOwner(senderNum, sender);
            const isGroup = jid.endsWith('@g.us');
            const isAdmin = isGroup ? await checkAdmin(jid, sender) : false;
            const prefix = await db.get('prefix', '.');
            const canToggle = isUserOwner || (isGroup && isAdmin);

            // Log commands
            if (lower.startsWith('.') || lower.startsWith(prefix)) {
                console.log(`📩 [${senderNum}] "${lower}"`);
            }

            // Check bot mode access
            if (!await canUseBot(jid, isUserOwner)) {
                if (lower.startsWith(prefix) || lower.startsWith('.')) {
                    const mode = await db.get('botMode', 'public');
                    await sock.sendMessage(jid, {
                        text: '╭' + '─'.repeat(30) + '╮\n┃  🔒 *' + mode.toUpperCase() + ' Mode!*  ┃\n╰' + '─'.repeat(30) + '╯' + beautifulFooter()
                    });
                }
                return;
            }

            // Check ban
            if (await db.banCheck(sender) && !isUserOwner) return;

            // ============================================================
            // 📋 MENU COMMAND
            // ============================================================
            if (lower === '.menu' || lower === `${prefix}menu` || lower === 'menu') {
                const btnEnabled = await db.get('buttonMenuEnabled', true);
                if (btnEnabled) {
                    await sendBeautifulMenu(sock, jid, db, config, isUserOwner, isAdmin, isGroup, prefix);
                } else {
                    await sendBeautifulMenu(sock, jid, db, config, isUserOwner, isAdmin, isGroup, prefix);
                }
                return;
            }

            // ============================================================
            // ⚙️ SETTINGS COMMAND
            // ============================================================
            if (lower === '.settings' || lower === `${prefix}settings` || lower === 'settings') {
                await sendBeautifulSettings(sock, jid, db, isUserOwner, config);
                return;
            }

            // ============================================================
            // 📊 STATS COMMAND
            // ============================================================
            if (lower === '.stats' || lower === `${prefix}stats` || lower === 'stats') {
                await sendBeautifulStats(sock, jid, db, config);
                return;
            }

            // ============================================================
            // 📰 NEWS COMMAND
            // ============================================================
            if (lower === '.news' || lower === `${prefix}news` || lower === 'news') {
                if (!await db.get('autoNewsEnabled', true) && !isUserOwner) {
                    await sock.sendMessage(jid, {
                        text: '❌ *News Disabled!*' + beautifulFooter()
                    });
                    return;
                }
                await sock.sendMessage(jid, {
                    text: '📰 *Fetching latest news...*\n⏳ Please wait...' + beautifulFooter()
                });
                await checkAndShareAllNewNews();
                return;
            }

            // ============================================================
            // 🎵 TOGGLE COMMANDS
            // ============================================================
            if (canToggle) {
                // Voice toggle
                if (lower === '.voice on' || lower === `${prefix}voice on`) {
                    await db.set('voiceReplyEnabled', true);
                    await sock.sendMessage(jid, {
                        text: '🎵 *Voice: ON* ✅' + beautifulFooter()
                    });
                    return;
                }
                if (lower === '.voice off' || lower === `${prefix}voice off`) {
                    await db.set('voiceReplyEnabled', false);
                    await sock.sendMessage(jid, {
                        text: '🎵 *Voice: OFF* ❌' + beautifulFooter()
                    });
                    return;
                }

                // Buttons toggle
                if (lower === '.buttons on' || lower === `${prefix}buttons on`) {
                    await db.set('buttonMenuEnabled', true);
                    await sock.sendMessage(jid, {
                        text: '🔘 *Buttons: ON* ✅' + beautifulFooter()
                    });
                    return;
                }
                if (lower === '.buttons off' || lower === `${prefix}buttons off`) {
                    await db.set('buttonMenuEnabled', false);
                    await sock.sendMessage(jid, {
                        text: '📋 *Text Menu: ON* ✅' + beautifulFooter()
                    });
                    return;
                }

                // Anti-link toggle
                if (lower === '.antilink on' || lower === `${prefix}antilink on`) {
                    await db.set('antiLinkEnabled', true);
                    await sock.sendMessage(jid, {
                        text: '🔗 *Anti-Link: ON* ✅' + beautifulFooter()
                    });
                    return;
                }
                if (lower === '.antilink off' || lower === `${prefix}antilink off`) {
                    await db.set('antiLinkEnabled', false);
                    await sock.sendMessage(jid, {
                        text: '🔗 *Anti-Link: OFF* ❌' + beautifulFooter()
                    });
                    return;
                }

                // Welcome toggle
                if (lower === '.welcome on' || lower === `${prefix}welcome on`) {
                    await db.set('welcomeEnabled', true);
                    await sock.sendMessage(jid, {
                        text: '👋 *Welcome: ON* ✅' + beautifulFooter()
                    });
                    return;
                }
                if (lower === '.welcome off' || lower === `${prefix}welcome off`) {
                    await db.set('welcomeEnabled', false);
                    await sock.sendMessage(jid, {
                        text: '👋 *Welcome: OFF* ❌' + beautifulFooter()
                    });
                    return;
                }

                // Goodbye toggle
                if (lower === '.goodbye on' || lower === `${prefix}goodbye on`) {
                    await db.set('goodbyeEnabled', true);
                    await sock.sendMessage(jid, {
                        text: '👋 *Goodbye: ON* ✅' + beautifulFooter()
                    });
                    return;
                }
                if (lower === '.goodbye off' || lower === `${prefix}goodbye off`) {
                    await db.set('goodbyeEnabled', false);
                    await sock.sendMessage(jid, {
                        text: '👋 *Goodbye: OFF* ❌' + beautifulFooter()
                    });
                    return;
                }

                // Auto bio toggle
                if (lower === '.autobio on' || lower === `${prefix}autobio on`) {
                    await db.set('autoBioEnabled', true);
                    await sock.sendMessage(jid, {
                        text: '📝 *Auto Bio: ON* ✅' + beautifulFooter()
                    });
                    return;
                }
                if (lower === '.autobio off' || lower === `${prefix}autobio off`) {
                    await db.set('autoBioEnabled', false);
                    await sock.sendMessage(jid, {
                        text: '📝 *Auto Bio: OFF* ❌' + beautifulFooter()
                    });
                    return;
                }
            }

            // ============================================================
            // 🎤 VOICE REPLIES (DM Only)
            // ============================================================
            if (!isGroup && !isUserOwner && await db.get('voiceReplyEnabled', true)) {
                if (voiceClips?.replies) {
                    for (const [trigger, url] of Object.entries(voiceClips.replies)) {
                        const words = lower.split(/\s+/);
                        if (
                            lower === trigger ||
                            words.includes(trigger) ||
                            (trigger.includes(' ') && lower.includes(trigger))
                        ) {
                            try {
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
                                }
                            } catch (e) {
                                // Silent fail
                            }
                            return;
                        }
                    }
                }
            }

            // ============================================================
            // 👑 OWNER COMMANDS
            // ============================================================
            if (isUserOwner) {
                // Mode command
                if (lower === '.mode' || lower.startsWith('.mode ') || lower === `${prefix}mode`) {
                    const modeArg = text.replace('.mode', '').replace(`${prefix}mode`, '').trim().toLowerCase();
                    const validModes = ['private', 'inbox', 'groups', 'public'];
                    const modeEmoji = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };

                    if (validModes.includes(modeArg)) {
                        await db.set('botMode', modeArg);
                        await sock.sendMessage(jid, {
                            text: modeEmoji[modeArg] + ' *Mode: ' + modeArg.toUpperCase() + '*\n\n' + beautifulFooter()
                        });
                    } else {
                        const currentMode = await db.get('botMode', 'public');
                        await sock.sendMessage(jid, {
                            text: modeEmoji[currentMode] + ' *Current: ' + currentMode.toUpperCase() +
                                  '*\n💡 .mode private/inbox/groups/public\n\n' + beautifulFooter()
                        });
                    }
                    return;
                }

                // Auto status toggle
                if (lower === '.autostatus on' || lower === `${prefix}autostatus on`) {
                    await db.set('autoStatusView', true);
                    await db.set('autoStatusReact', true);
                    await sock.sendMessage(jid, {
                        text: '🖤 *Auto Status: ON* ✅' + beautifulFooter()
                    });
                    return;
                }
                if (lower === '.autostatus off' || lower === `${prefix}autostatus off`) {
                    await db.set('autoStatusView', false);
                    await db.set('autoStatusReact', false);
                    await sock.sendMessage(jid, {
                        text: '🖤 *Auto Status: OFF* ❌' + beautifulFooter()
                    });
                    return;
                }

                // Auto news toggle
                if (lower === '.autonews on' || lower === `${prefix}autonews on`) {
                    await db.set('autoNewsEnabled', true);
                    await sock.sendMessage(jid, {
                        text: '📰 *Auto News: ON* ✅' + beautifulFooter()
                    });
                    return;
                }
                if (lower === '.autonews off' || lower === `${prefix}autonews off`) {
                    await db.set('autoNewsEnabled', false);
                    await sock.sendMessage(jid, {
                        text: '📰 *Auto News: OFF* ❌' + beautifulFooter()
                    });
                    return;
                }

                // Set prefix
                if (lower.startsWith('.setprefix ') || lower.startsWith(`${prefix}setprefix `)) {
                    const newPrefix = text.replace('.setprefix', '').replace(`${prefix}setprefix`, '').trim();
                    if (newPrefix.length >= 1 && newPrefix.length <= 3) {
                        await db.set('prefix', newPrefix);
                        await sock.sendMessage(jid, {
                            text: '🔧 *Prefix: "' + newPrefix + '"*\n💡 Use *' + newPrefix + 'menu*\n\n' + beautifulFooter()
                        });
                    }
                    return;
                }

                // Broadcast
                if (lower.startsWith('.broadcast ') || lower.startsWith(`${prefix}broadcast `)) {
                    const broadcastMsg = text.replace('.broadcast', '').replace(`${prefix}broadcast`, '').trim();
                    try {
                        const groups = await sock.groupFetchAllParticipating();
                        let count = 0;
                        for (const groupId of Object.keys(groups)) {
                            try {
                                await sock.sendMessage(groupId, {
                                    text: '📢 *Broadcast*\n\n' + broadcastMsg + '\n\n' + beautifulFooter()
                                });
                                count++;
                                await new Promise(r => setTimeout(r, 1000));
                            } catch {}
                        }
                        await sock.sendMessage(jid, {
                            text: '📢 Sent to *' + count + '* groups!' + beautifulFooter()
                        });
                    } catch {}
                    return;
                }

                // Ban user
                if (lower.startsWith('.ban ') || lower.startsWith(`${prefix}ban `)) {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (mentioned?.length) {
                        await db.banAdd(mentioned[0]);
                        await sock.sendMessage(jid, {
                            text: '🚫 @' + mentioned[0].split('@')[0] + ' *banned!*\n\n' + beautifulFooter(),
                            mentions: [mentioned[0]]
                        });
                    }
                    return;
                }

                // Unban user
                if (lower.startsWith('.unban ') || lower.startsWith(`${prefix}unban `)) {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (mentioned?.length) {
                        await db.banRemove(mentioned[0]);
                        await sock.sendMessage(jid, {
                            text: '✅ @' + mentioned[0].split('@')[0] + ' *unbanned!*\n\n' + beautifulFooter(),
                            mentions: [mentioned[0]]
                        });
                    }
                    return;
                }

                // Ban list
                if (lower === '.banlist' || lower === `${prefix}banlist`) {
                    const bans = await db.banAll();
                    if (!bans.length) {
                        await sock.sendMessage(jid, {
                            text: '✅ *No bans!*' + beautifulFooter()
                        });
                    } else {
                        const banList = bans.map((b, i) => (i + 1) + '. @' + b.userId.split('@')[0]).join('\n');
                        await sock.sendMessage(jid, {
                            text: '🚫 *Banned (' + bans.length + ')*\n' + banList + '\n\n' + beautifulFooter(),
                            mentions: bans.map(b => b.userId)
                        });
                    }
                    return;
                }
            }

            // ============================================================
            // 👥 GROUP COMMANDS
            // ============================================================
            if (isGroup) {
                // List admins
                if (lower === '.admins' || lower === `${prefix}admins`) {
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const admins = metadata.participants.filter(p => p.admin);
                        const adminList = admins.map(p => '👑 @' + p.id.split('@')[0]).join('\n');
                        const sent = await sock.sendMessage(jid, {
                            text: '👑 *Admins*\n' + adminList + '\n\n' + beautifulFooter(),
                            mentions: admins.map(p => p.id)
                        });
                        await sock.sendMessage(jid, { react: { text: '👑', key: sent.key } });
                    } catch {}
                    return;
                }

                // Group info
                if (lower === '.groupinfo' || lower === `${prefix}groupinfo` || lower === '.gcinfo') {
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const sent = await sock.sendMessage(jid, {
                            text: '📋 *' + metadata.subject + '*\n👥 ' + metadata.participants.length +
                                  '\n👑 @' + metadata.owner?.split('@')[0] + '\n\n' + beautifulFooter(),
                            mentions: [metadata.owner]
                        });
                        await sock.sendMessage(jid, { react: { text: '📋', key: sent.key } });
                    } catch {}
                    return;
                }

                // Tag all
                if (lower === '.tagall' || lower === `${prefix}tagall` || lower === '.everyone') {
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const sent = await sock.sendMessage(jid, {
                            text: '📢 *Everyone!*\n\n' + beautifulFooter(),
                            mentions: metadata.participants.map(p => p.id)
                        });
                        await sock.sendMessage(jid, { react: { text: '📢', key: sent.key } });
                    } catch {}
                    return;
                }

                // Poll
                if (lower.startsWith('.poll ') || lower.startsWith(`${prefix}poll `)) {
                    const question = text.replace('.poll', '').replace(`${prefix}poll`, '').trim();
                    const sent = await sock.sendMessage(jid, {
                        poll: {
                            name: '📊 ' + question,
                            values: ['👍 Yes', '👎 No', '🤔 Maybe'],
                            selectableCount: 1
                        }
                    });
                    await sock.sendMessage(jid, { react: { text: '📊', key: sent.key } });
                    return;
                }

                // AFK
                if (lower.startsWith('.afk') || lower.startsWith(`${prefix}afk`)) {
                    const reason = text.replace('.afk', '').replace(`${prefix}afk`, '').trim() || 'AFK';
                    await db.afkSet(sender, reason);
                    const sent = await sock.sendMessage(jid, {
                        text: '💤 @' + sender.split('@')[0] + ' *AFK:* ' + reason + '\n\n' + beautifulFooter(),
                        mentions: [sender]
                    });
                    await sock.sendMessage(jid, { react: { text: '💤', key: sent.key } });
                    return;
                }

                // ============================================================
                // 🛡️ GROUP ADMIN COMMANDS
                // ============================================================
                if (isAdmin || isUserOwner) {
                    // Mute
                    if (lower === '.mute' || lower === `${prefix}mute`) {
                        await db.groupSet(jid, 'isMuted', true);
                        await sock.sendMessage(jid, {
                            text: '🔇 *Muted 30min*\n\n' + beautifulFooter()
                        });
                        setTimeout(() => db.groupSet(jid, 'isMuted', false), 30 * 60 * 1000);
                        return;
                    }

                    // Unmute
                    if (lower === '.unmute' || lower === `${prefix}unmute`) {
                        await db.groupSet(jid, 'isMuted', false);
                        await sock.sendMessage(jid, {
                            text: '🔊 *Unmuted!*\n\n' + beautifulFooter()
                        });
                        return;
                    }

                    // Warn
                    if (lower.startsWith('.warn ') || lower.startsWith(`${prefix}warn `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            const count = await db.warnAdd(mentioned[0], jid);
                            await sock.sendMessage(jid, {
                                text: '⚠️ @' + mentioned[0].split('@')[0] + ' (*' + count + '/3*)\n\n' + beautifulFooter(),
                                mentions: [mentioned[0]]
                            });
                            if (count >= 3) {
                                try {
                                    await sock.groupParticipantsUpdate(jid, [mentioned[0]], 'remove');
                                    await db.warnClear(mentioned[0], jid);
                                } catch {}
                            }
                        }
                        return;
                    }

                    // Kick
                    if (lower.startsWith('.kick ') || lower.startsWith(`${prefix}kick `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            try {
                                await sock.groupParticipantsUpdate(jid, [mentioned[0]], 'remove');
                                await sock.sendMessage(jid, {
                                    text: '🚫 @' + mentioned[0].split('@')[0] + ' *kicked!*\n\n' + beautifulFooter(),
                                    mentions: [mentioned[0]]
                                });
                            } catch {}
                        }
                        return;
                    }

                    // Add
                    if (lower.startsWith('.add ') || lower.startsWith(`${prefix}add `)) {
                        const number = text.replace('.add', '').replace(`${prefix}add`, '').trim().replace(/[^0-9]/g, '');
                        if (number) {
                            try {
                                await sock.groupParticipantsUpdate(jid, [number + '@s.whatsapp.net'], 'add');
                                await sock.sendMessage(jid, {
                                    text: '✅ *' + number + ' added!*\n\n' + beautifulFooter()
                                });
                            } catch {}
                        }
                        return;
                    }

                    // Promote
                    if (lower.startsWith('.promote ') || lower.startsWith(`${prefix}promote `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            try {
                                await sock.groupParticipantsUpdate(jid, [mentioned[0]], 'promote');
                                await sock.sendMessage(jid, {
                                    text: '👑 @' + mentioned[0].split('@')[0] + ' *promoted!*\n\n' + beautifulFooter(),
                                    mentions: [mentioned[0]]
                                });
                            } catch {}
                        }
                        return;
                    }

                    // Demote
                    if (lower.startsWith('.demote ') || lower.startsWith(`${prefix}demote `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            try {
                                await sock.groupParticipantsUpdate(jid, [mentioned[0]], 'demote');
                                await sock.sendMessage(jid, {
                                    text: '⬇️ @' + mentioned[0].split('@')[0] + ' *demoted!*\n\n' + beautifulFooter(),
                                    mentions: [mentioned[0]]
                                });
                            } catch {}
                        }
                        return;
                    }
                }
            }

            // ============================================================
            // 💾 SAVE MEDIA COMMAND
            // ============================================================
            if (lower === '.save' || lower === `${prefix}save` || lower === '.ss') {
                const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                if (contextInfo?.quotedMessage) {
                    const fakeMessage = {
                        key: { remoteJid: jid, id: contextInfo.stanzaId },
                        message: contextInfo.quotedMessage
                    };
                    const saved = await saveMediaToFile(fakeMessage);
                    if (saved) {
                        if (saved.type === 'imageMessage') {
                            await sock.sendMessage(jid, {
                                image: saved.buffer,
                                caption: '💾 *Saved!*\n\n' + beautifulFooter()
                            });
                        } else if (saved.type === 'videoMessage') {
                            await sock.sendMessage(jid, {
                                video: saved.buffer,
                                caption: '💾 *Saved!*\n\n' + beautifulFooter()
                            });
                        } else if (saved.type === 'stickerMessage') {
                            await sock.sendMessage(jid, { sticker: saved.buffer });
                        } else {
                            await sock.sendMessage(jid, {
                                document: saved.buffer,
                                fileName: saved.filename,
                                caption: '💾 *Saved!*\n\n' + beautifulFooter()
                            });
                        }
                    } else {
                        await sock.sendMessage(jid, {
                            text: '❌ *Failed!*\n\n' + beautifulFooter()
                        });
                    }
                } else {
                    await sock.sendMessage(jid, {
                        text: '💡 Reply to media with *' + prefix + 'save*\n\n' + beautifulFooter()
                    });
                }
                return;
            }

            // ============================================================
            // 👁️ VIEW-ONCE SAVER
            // ============================================================
            if (lower === '.vv' || lower === `${prefix}vv` || lower === 'vv') {
                const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                if (
                    contextInfo?.quotedMessage?.imageMessage?.viewOnce ||
                    contextInfo?.quotedMessage?.videoMessage?.viewOnce
                ) {
                    const fakeMessage = {
                        key: {
                            remoteJid: jid,
                            id: contextInfo.stanzaId,
                            participant: contextInfo.participant
                        },
                        message: contextInfo.quotedMessage
                    };
                    const saved = await saveMediaToFile(fakeMessage, VV_FOLDER);
                    if (saved && ownerJid) {
                        const caption = '📱 *VV Saved!*\n👤 @' + sender.split('@')[0] + '\n\n' + beautifulFooter();
                        try {
                            if (saved.type === 'imageMessage') {
                                await sock.sendMessage(ownerJid, {
                                    image: saved.buffer,
                                    caption: caption,
                                    mentions: [sender]
                                });
                            } else if (saved.type === 'videoMessage') {
                                await sock.sendMessage(ownerJid, {
                                    video: saved.buffer,
                                    caption: caption,
                                    mentions: [sender]
                                });
                            }
                        } catch (e) {}
                    }
                    await sock.sendMessage(jid, {
                        text: saved ? '✅ *Saved!* 📥\n\n' + beautifulFooter() : '❌ *Failed!*\n\n' + beautifulFooter()
                    });
                } else {
                    await sock.sendMessage(jid, {
                        text: '💡 Reply to VV with *' + prefix + 'vv*\n\n' + beautifulFooter()
                    });
                }
                return;
            }

            // ============================================================
            // 🔗 ANTI-LINK DETECTION
            // ============================================================
            if (
                isGroup &&
                await db.get('antiLinkEnabled', false) &&
                /https?:\/\/(?:chat\.whatsapp\.com|t\.me|discord\.gg)/i.test(text) &&
                !isAdmin &&
                !isUserOwner
            ) {
                try {
                    await sock.sendMessage(jid, { delete: msg.key });
                } catch (e) {}
                await sock.sendMessage(jid, {
                    text: '🔗 *Link Deleted!*\n👤 @' + sender.split('@')[0] + '\n\n' + beautifulFooter(),
                    mentions: [sender]
                });
                return;
            }

            // ============================================================
            // 💤 AFK DETECTION
            // ============================================================
            if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                for (const mentioned of msg.message.extendedTextMessage.contextInfo.mentionedJid) {
                    const afkData = await db.afkGet(mentioned);
                    if (afkData) {
                        const minutes = Math.floor(
                            (Date.now() - new Date(afkData.afkAt).getTime()) / 60000
                        );
                        await sock.sendMessage(jid, {
                            text: '💤 @' + mentioned.split('@')[0] + ' *AFK:* ' + afkData.reason +
                                  ' (' + minutes + 'm)\n\n' + beautifulFooter(),
                            mentions: [mentioned]
                        });
                    }
                }
            }

            // Auto-remove AFK when user sends message
            if (
                await db.afkGet(sender) &&
                !lower.startsWith('.afk') &&
                !lower.startsWith(`${prefix}afk`)
            ) {
                await db.afkRemove(sender);
            }
        }
    });

    // ============================================================
    // 👥 GROUP PARTICIPANT UPDATES
    // ============================================================
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        // Welcome message
        if (action === 'add' && await db.get('welcomeEnabled', false)) {
            const welcomeMsg = await db.get('welcomeMessage', '👋 Welcome @user! 🎉');
            for (const participant of participants) {
                await sock.sendMessage(id, {
                    text: '🎉 *Welcome!*\n\n' +
                          welcomeMsg.replace('@user', '@' + participant.split('@')[0]) +
                          '\n\n' + beautifulFooter(),
                    mentions: [participant]
                });
            }
        }

        // Goodbye message
        if (action === 'remove' && await db.get('goodbyeEnabled', false)) {
            const goodbyeMsg = await db.get('goodbyeMessage', '👋 Goodbye @user! 😢');
            for (const participant of participants) {
                await sock.sendMessage(id, {
                    text: '😢 *Goodbye!*\n\n' +
                          goodbyeMsg.replace('@user', '@' + participant.split('@')[0]) +
                          '\n\n' + beautifulFooter(),
                    mentions: [participant]
                });
            }
        }
    });

    // ============================================================
    // 🔌 CONNECTION UPDATES
    // ============================================================
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        // Show QR code
        if (qr) {
            console.log('\n📱 Scan QR Code:\n');
            qrcode.generate(qr, { small: true });
        }

        // Connection closed
        if (connection === 'close') {
            isConnected = false;
            sock = null;

            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut && !isShuttingDown) {
                reconnectAttempts++;
                console.log(`\n🔄 Reconnecting... Attempt ${reconnectAttempts}\n`);
                reconnectTimer = setTimeout(async () => {
                    reconnectTimer = null;
                    await startBot();
                }, Math.min(30000, 5000 * reconnectAttempts));
            } else {
                console.log('\n❌ Logged out!\n');
            }
        }

        // Connection opened
        else if (connection === 'open') {
            isConnected = true;
            reconnectAttempts = 0;

            if (sock.user) {
                ownerJid = sock.user.id.replace(/:.*/, '') + '@s.whatsapp.net';
            }

            // Beautiful startup console
            console.log('\n' + '═'.repeat(50));
            console.log('  💝 NewsBot LK - Connected! 💝');
            console.log('═'.repeat(50));
            console.log(`  👑 Owner: ${ownerJid}`);
            console.log(`  🗄️ DB: ${useJsonFallback ? 'JSON' : 'MongoDB'}`);
            console.log(`  🦄 v${config.version}`);
            console.log('═'.repeat(50) + '\n');

            // Send connected message to owner
            if (ownerJid) {
                await sendConnectedMessage();
            }

            // Initial news fetch
            if (await db.get('autoNewsEnabled', true)) {
                await checkAndShareAllNewNews();
            }

            // Update bio
            setTimeout(async () => {
                await updateBotBio();
            }, 5000);
        }
    });

    // Save credentials
    sock.ev.on('creds.update', saveCreds);
}

// ============================================================
// 💝 CONNECTED MESSAGE
// ============================================================
async function sendConnectedMessage() {
    if (!ownerJid) return;

    const msg = [
        '╔' + '═'.repeat(40) + '╗',
        '║     💝 *NewsBot LK* 💝        ║',
        '║  🦄 ✨ *Successfully* ✨ 🦄    ║',
        '║      *Connected!*             ║',
        '╚' + '═'.repeat(40) + '╝',
        '',
        '┌' + '─'.repeat(36) + '┐',
        '│  ✅ *Status:* Online          │',
        '│  🖤 *Status React:* ' + statusBadge(await db.get('autoStatusReact', true)) + '      │',
        '│  📋 *.menu:* Show Menu        │',
        '│  ⚙️ *.settings:* Settings     │',
        '│  🔘 *Buttons:* ' + statusBadge(await db.get('buttonMenuEnabled', true)) + '          │',
        '└' + '─'.repeat(36) + '┘',
        '',
        beautifulFooter()
    ].join('\n');

    try {
        await sock.sendMessage(ownerJid, {
            image: { url: BOT_LOGO },
            caption: msg,
            mimetype: 'image/png'
        });
    } catch (e) {}
}

// ============================================================
// 📰 NEWS SYSTEM
// ============================================================

/**
 * Scrape article details from URL
 */
async function scrapeArticle(url) {
    try {
        const { data: html } = await axios.get(url, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!html) return { description: '', image: '' };

        // Extract OG image
        let image = '';
        const ogMatch = html.match(
            /<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i
        );
        if (ogMatch?.[1]) image = ogMatch[1];

        // Clean HTML
        const cleanHtml = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '');

        // Extract content
        let description = '';
        const patterns = [
            /<div[^>]*class="[^"]*news-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<article[^>]*>([\s\S]*?)<\/article>/i
        ];

        for (const pattern of patterns) {
            const match = cleanHtml.match(pattern);
            if (match?.[1]) {
                const paragraphs = match[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
                if (paragraphs) {
                    description = paragraphs
                        .map(p => p.replace(/<[^>]*>/g, '').trim())
                        .filter(p => p.length > 30)
                        .join('\n\n');
                    if (description.length > 200) break;
                }
            }
        }

        if (!description) {
            const allParagraphs = cleanHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
            if (allParagraphs) {
                description = allParagraphs
                    .map(p => p.replace(/<[^>]*>/g, '').trim())
                    .filter(p => p.length > 30)
                    .join('\n\n');
            }
        }

        return {
            description: cleanText(description || ''),
            image: image
        };
    } catch {
        return { description: '', image: '' };
    }
}

/**
 * Fetch Hiru News
 */
async function fetchHiruNews() {
    const hiru = new Hiru();
    const categories = ['BreakingNews', 'MainNews', 'TrendingNews'];
    const newsItems = [];
    const seenUrls = new Set();

    for (const category of categories) {
        if (typeof hiru[category] !== 'function') continue;
        try {
            const result = await hiru[category]();
            const url = result?.results?.newsURL;
            const title = result?.results?.title;

            if (url && !seenUrls.has(url) && title) {
                seenUrls.add(url);
                newsItems.push({
                    source: '🇱🇰 Hiru News',
                    category: category.replace('News', ''),
                    title: title,
                    description: cleanText(result.results.news || ''),
                    url: url,
                    image: result.results.thumb || '',
                    date: result.results.date || ''
                });
            }
        } catch (e) {}
    }
    return newsItems;
}

/**
 * Fetch Derana News
 */
async function fetchDeranaNews() {
    const newsItems = [];
    try {
        const results = await Derana.scrapeHotNews();
        if (Array.isArray(results)) {
            for (const article of results.slice(0, 3)) {
                const url = article.url || '';
                const title = article.title || '';
                if (url && title) {
                    const { description, image } = await scrapeArticle(url);
                    let desc = description;
                    if (!desc || desc.length < 100) {
                        desc = article.content || article.description || title;
                        desc = String(desc).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                    }
                    newsItems.push({
                        source: '🔴 Derana',
                        category: 'Hot News',
                        title: title,
                        description: desc,
                        url: url,
                        image: image || FALLBACK_IMAGE,
                        date: article.time || ''
                    });
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }
    } catch (e) {}
    return newsItems;
}

/**
 * Fetch RSS Feed
 */
async function fetchRSS(url, source, limit = 3) {
    const newsItems = [];
    try {
        const { data } = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const items = data.match(/<item>([\s\S]*?)<\/item>/gi) || [];
        for (const item of items.slice(0, limit)) {
            const title = (item.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim() || '';
            const link = (item.match(/<link>([^<]+)<\/link>/i) || [])[1]?.trim() || '';
            const image = (item.match(/<media:content[^>]*url="([^"]*)"/i) || [])[1]?.trim() || '';
            if (title && link) {
                const { description } = await scrapeArticle(link);
                newsItems.push({
                    source: source,
                    category: 'Latest',
                    title: title,
                    description: description || title,
                    url: link,
                    image: image || FALLBACK_IMAGE,
                    date: ''
                });
                await new Promise(r => setTimeout(r, 500));
            }
        }
    } catch (e) {}
    return newsItems;
}

/**
 * Fetch all latest news from all sources
 */
async function fetchAllLatestNews() {
    const sources = [
        { name: 'Hiru', fetch: fetchHiruNews },
        { name: 'Derana', fetch: fetchDeranaNews },
        { name: 'AdaDerana', fetch: () => fetchRSS('https://www.adaderana.lk/rss.php', '📰 AdaDerana') },
        { name: 'Cricket', fetch: () => fetchRSS('https://www.espncricinfo.com/rss/content/story/feeds/8.xml', '🏏 ESPN', 2) },
        {
            name: 'Ada.lk',
            fetch: async () => {
                try {
                    const result = await dynews.ada();
                    if (result?.status && result.result?.url) {
                        const desc = cleanText(result.result.desc || '');
                        if (desc.length > 50) {
                            return [{
                                source: '📰 Ada.lk',
                                category: 'Latest',
                                title: result.result.title,
                                description: desc,
                                url: result.result.url,
                                image: result.result.image || FALLBACK_IMAGE,
                                date: `${result.result.date} ${result.result.time}`
                            }];
                        }
                    }
                } catch (e) {}
                return [];
            }
        },
        {
            name: 'Newswire',
            fetch: async () => {
                try {
                    const result = await dynews.newswire();
                    if (result?.status && result.result?.url) {
                        const desc = cleanText(result.result.desc || '');
                        if (desc.length > 50) {
                            return [{
                                source: '📰 Newswire',
                                category: 'Latest',
                                title: result.result.title,
                                description: desc,
                                url: result.result.url,
                                image: result.result.image || FALLBACK_IMAGE,
                                date: `${result.result.date} ${result.result.time}`
                            }];
                        }
                    }
                } catch (e) {}
                return [];
            }
        },
        {
            name: 'Sirasa',
            fetch: async () => {
                try {
                    const result = await dynews.sirasa();
                    if (result?.status && result.result?.url) {
                        const desc = cleanText(result.result.desc || '');
                        if (desc.length > 50) {
                            return [{
                                source: '📺 Sirasa',
                                category: 'Latest',
                                title: result.result.title,
                                description: desc,
                                url: result.result.url,
                                image: result.result.image || FALLBACK_IMAGE,
                                date: `${result.result.date} ${result.result.time}`
                            }];
                        }
                    }
                } catch (e) {}
                return [];
            }
        }
    ];

    const results = await Promise.allSettled(sources.map(s => s.fetch()));
    const allNews = [];
    
    sources.forEach((source, index) => {
        if (results[index].status === 'fulfilled' && Array.isArray(results[index].value)) {
            allNews.push(...results[index].value);
        }
    });

    // Deduplicate
    const uniqueNews = [];
    const seenUrls = new Set();
    for (const article of allNews) {
        if (article.url && !seenUrls.has(article.url)) {
            seenUrls.add(article.url);
            uniqueNews.push(article);
        }
    }

    return uniqueNews;
}

/**
 * Send news article to group
 */
async function sendNews(jid, article) {
    if (!sock?.user) return false;

    const description = truncate((article.description || article.title || '').trim(), 5000);

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
        let sent;
        if (article.image?.length > 10) {
            try {
                sent = await sock.sendMessage(jid, {
                    image: { url: article.image },
                    caption: caption,
                    mimetype: 'image/jpeg'
                });
            } catch (e) {}
        }
        if (!sent) {
            sent = await sock.sendMessage(jid, {
                image: { url: BOT_LOGO },
                caption: caption,
                mimetype: 'image/png'
            });
        }
        await sock.sendMessage(jid, {
            react: { text: randEmoji(REACTIONS), key: sent.key }
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Check and share new news articles
 */
async function checkAndShareAllNewNews() {
    if (!sock?.user) return;
    if (await db.groupGet(NEWS_GROUP_JID, 'isMuted', false)) return;

    try {
        const allNews = await fetchAllLatestNews();
        if (!allNews.length) return;

        const sentUrls = await db.urlsGet();

        // First run: initialize URL database
        if (!sentUrls.length) {
            for (const article of allNews) {
                if (article.url) await db.urlsAdd(article.url);
            }
            return;
        }

        // Share new articles
        let sharedCount = 0;
        for (const article of allNews) {
            if (!article.url || sentUrls.includes(article.url)) continue;
            if (await sendNews(NEWS_GROUP_JID, article)) {
                await db.urlsAdd(article.url);
                sharedCount++;
            }
            await new Promise(r => setTimeout(r, 3000));
        }

        if (sharedCount > 0) {
            console.log(`📰 Shared ${sharedCount} new articles`);
        }
    } catch (e) {
        console.error('❌ News check failed:', e.message);
    }
}

// ============================================================
// 🚀 STARTUP
// ============================================================
(async () => {
    // Beautiful startup banner
    console.log('\n' + '═'.repeat(50));
    console.log('  💝 NewsBot LK v' + config.version + ' 💝');
    console.log('═'.repeat(50));
    console.log('  👨‍💻 ' + config.developer);
    console.log('  👑 Owners: ' + OWNER_NUMBERS.join(', '));
    console.log('  🌐 ' + config.portfolio);
    console.log('═'.repeat(50));
    console.log('  💝 Dedicated to:');
    console.log('  🌸 Umesha Sathyanjali');
    console.log('  🌸 Mithila');
    console.log('  🌸 Sharada');
    console.log('═'.repeat(50) + '\n');

    // Connect to database
    await connectDatabase();

    // Start bot
    await startBot();

    // Auto news interval
    setInterval(async () => {
        if (await db.get('autoNewsEnabled', true)) {
            await checkAndShareAllNewNews();
        }
    }, CHECK_INTERVAL_MS);

    // Auto bio interval
    setInterval(async () => {
        await updateBotBio();
    }, 30 * 60 * 1000);

    console.log('🦄💝 NewsBot LK is running! 💝🦄\n');
})();
