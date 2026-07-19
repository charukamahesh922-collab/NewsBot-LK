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

// News scrapers
const Hiru = require('hirunews-scrap');
const Derana = require('ada-derana-news-scraper');
const DY_NEWS = require('@dark-yasiya/news-scrap');

// Local files
const config = require('./config');
const voiceClips = require('./voiceReplies');

const dynews = new DY_NEWS();

// ============================================================
// 🧹 STARTUP CLEANUP
// ============================================================
try {
    const pidFile = path.join(__dirname, 'app.pid');
    if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
    }
} catch (error) {
    // Ignore cleanup errors
}
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

// Folder paths
const SAVE_FOLDER = path.join(__dirname, 'saved_media');
const STATUS_FOLDER = path.join(__dirname, 'saved_status');
const VV_FOLDER = path.join(__dirname, 'view_once_saved');
const TEST_MODE = true;

// Create required folders
[SAVE_FOLDER, STATUS_FOLDER, VV_FOLDER].forEach((folder) => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
});

// ============================================================
// 🗄️ JSON DATABASE (FALLBACK)
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

/**
 * Load JSON database from file
 */
function loadJsonDb() {
    try {
        if (fs.existsSync(JSON_DB_FILE)) {
            const rawData = fs.readFileSync(JSON_DB_FILE, 'utf8');
            const parsedData = JSON.parse(rawData);
            jsonDb = {
                settings: {},
                warnings: {},
                bans: [],
                afk: {},
                groupSettings: {},
                sentUrls: [],
                ...parsedData
            };
        }
    } catch (error) {
        console.error('❌ JSON DB Load Error:', error.message);
    }
}

/**
 * Save JSON database to file
 */
function saveJsonDb() {
    try {
        const jsonString = JSON.stringify(jsonDb, null, 2);
        fs.writeFileSync(JSON_DB_FILE, jsonString);
    } catch (error) {
        console.error('❌ JSON DB Save Error:', error.message);
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

    // Try internal then public MongoDB URLs
    const urls = [
        { name: 'Internal', url: config.mongoInternal },
        { name: 'Public', url: config.mongoPublic }
    ];

    for (const { name, url } of urls) {
        try {
            console.log(`🔌 Trying MongoDB (${name})...`);

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

            // Create default settings if empty
            const count = await Setting.countDocuments();
            if (count === 0) {
                console.log('📝 Creating default settings...');
                for (const [key, value] of Object.entries(config.defaults)) {
                    await Setting.create({ key, value });
                }
            }

            console.log(`✅ MongoDB Connected (${name})`);
            return true;

        } catch (error) {
            console.error(`❌ MongoDB ${name} failed:`, error.message);
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }
        }
    }

    // Fallback to JSON
    console.log('⚠️ All MongoDB connections failed, using JSON fallback');
    useJsonFallback = true;
    loadJsonDb();
    return false;
}

// ============================================================
// 🗃️ DATABASE OPERATIONS
// ============================================================
const db = {

    // ---------- CHECK ----------
    isJson: () => useJsonFallback,

    // ---------- SETTINGS ----------
    get: async (key, defaultValue) => {
        if (useJsonFallback) {
            return jsonDb.settings[key] ?? config.defaults[key] ?? defaultValue;
        }
        try {
            const record = await Setting.findOne({ key });
            return record ? record.value : (config.defaults[key] ?? defaultValue);
        } catch (error) {
            return config.defaults[key] ?? defaultValue;
        }
    },

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
        } catch (error) {
            return false;
        }
    },

    all: async () => {
        if (useJsonFallback) {
            return { ...config.defaults, ...jsonDb.settings };
        }
        try {
            const docs = await Setting.find({});
            const settings = {};
            docs.forEach((doc) => { settings[doc.key] = doc.value; });
            return { ...config.defaults, ...settings };
        } catch (error) {
            return { ...config.defaults };
        }
    },

    // ---------- WARNINGS ----------
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
        } catch (error) {
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
        } catch (error) {
            return false;
        }
    },

    // ---------- BANS ----------
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
        } catch (error) {
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
        } catch (error) {
            return false;
        }
    },

    banCheck: async (userId) => {
        if (useJsonFallback) {
            return jsonDb.bans.some(b => b.userId === userId);
        }
        try {
            return !!(await Ban.findOne({ userId }));
        } catch (error) {
            return false;
        }
    },

    banAll: async () => {
        if (useJsonFallback) return jsonDb.bans;
        try {
            return await Ban.find({});
        } catch (error) {
            return [];
        }
    },

    // ---------- AFK ----------
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
        } catch (error) {
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
        } catch (error) {
            return false;
        }
    },

    afkGet: async (userId) => {
        if (useJsonFallback) return jsonDb.afk[userId] || null;
        try {
            return await Afk.findOne({ userId });
        } catch (error) {
            return null;
        }
    },

    // ---------- GROUP SETTINGS ----------
    groupGet: async (groupId, key, defaultValue) => {
        if (useJsonFallback) {
            return jsonDb.groupSettings[groupId]?.[key] ?? defaultValue;
        }
        try {
            const record = await GroupSetting.findOne({ groupId });
            return record?.[key] ?? defaultValue;
        } catch (error) {
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
        } catch (error) {
            return false;
        }
    },

    // ---------- NEWS URL TRACKING ----------
    urlsGet: async () => {
        if (useJsonFallback) return jsonDb.sentUrls || [];
        try {
            const doc = await Setting.findOne({ key: 'sentUrls' });
            return doc?.value || [];
        } catch (error) {
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
        } catch (error) {
            return false;
        }
    },

    urlsCount: async () => {
        if (useJsonFallback) return jsonDb.sentUrls.length;
        try {
            const doc = await Setting.findOne({ key: 'sentUrls' });
            return doc?.value?.length || 0;
        } catch (error) {
            return 0;
        }
    }
};

// ============================================================
// 🎨 BEAUTIFUL UI HELPERS
// ============================================================

/**
 * 💝 Beautiful Footer - Appears on ALL bot messages
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
 * Section divider for menus
 */
const sectionDivider = (title, emoji) => {
    const line = '─'.repeat(8);
    return `\n${emoji} ${line} *${title}* ${line} ${emoji}\n`;
};

/**
 * Status badge: ✅ ON or ❌ OFF
 */
const statusBadge = (enabled) => {
    return enabled ? '✅ *ON*' : '❌ *OFF*';
};

/**
 * Clean HTML to plain text
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
// 🔐 AUTHENTICATION SYSTEM
// ============================================================
let sock = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let isConnected = false;
let isShuttingDown = false;
let lastStatusTime = 0;

// Owner information
let ownerJid = null;
let ownerPhone = null;
let ownerDeviceId = null;
let ownerLid = null;
let cleanOwnerJid = null; // ✅ CLEAN JID for sending messages

/**
 * Check if sender is the bot owner
 */
function isOwner(senderNumber, senderJid) {
    const cleanNumber = senderNumber.replace(/[^0-9]/g, '');

    // Check configured owner numbers
    if (OWNER_NUMBERS.some(num => num.replace(/[^0-9]/g, '') === cleanNumber)) {
        return true;
    }

    // Check connected JID (QR scan user)
    if (ownerJid) {
        const ownerClean = ownerJid
            .replace(/:.*/, '')
            .split('@')[0]
            .replace(/[^0-9]/g, '');

        if (cleanNumber === ownerClean) return true;
        if (senderJid.replace(/:.*/, '') === ownerJid.replace(/:.*/, '')) return true;
    }

    // Check stored phone
    if (ownerPhone && cleanNumber === ownerPhone.replace(/[^0-9]/g, '')) {
        return true;
    }

    return false;
}

/**
 * Check if user can use bot based on current mode
 */
async function canUseBot(jid, isUserOwner) {
    if (isUserOwner) return true;

    const mode = await db.get('botMode', 'public');
    const isGroupChat = jid.endsWith('@g.us');

    switch (mode) {
        case 'private':
            return false;
        case 'inbox':
            return !isGroupChat;
        case 'groups':
            return isGroupChat;
        default:
            return true;
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
    } catch (error) {
        return false;
    }
}

// ============================================================
// 📥 MEDIA HANDLERS
// ============================================================

/**
 * Download media from a WhatsApp message
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
    } catch (error) {
        return null;
    }
}

/**
 * Save media from message to file
 */
async function saveMediaToFile(msg, folder = SAVE_FOLDER) {
    try {
        let realMessage = msg;
        let messageType = Object.keys(msg.message || {})[0];

        // Handle view-once messages
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

        // Download the media
        const buffer = await downloadMedia(realMessage);
        if (!buffer || buffer.length < 100) return null;

        // Save to file
        const filename = `media_${Date.now()}${extension}`;
        fs.writeFileSync(path.join(folder, filename), buffer);

        return {
            buffer: buffer,
            type: messageType,
            ext: extension,
            filename: filename
        };
    } catch (error) {
        return null;
    }
}

/**
 * Update WhatsApp bio/profile status
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

        const bioText = [
            `💝 ${config.botName} | Auto Mode`,
            `📅 ${dateStr}`,
            `⏰ ${timeStr}`,
            `🦄 Powered by Charuka Mahesh`
        ].join('\n');

        await sock.updateProfileStatus(bioText);
    } catch (error) {
        // Silent fail - bio update is not critical
    }
}

/**
 * Handle WhatsApp status updates
 */
async function handleStatus(msg) {
    if (!sock) return;

    try {
        const { key } = msg;

        // Skip own status
        if (key.fromMe) return;

        // Get status owner
        const participant = key.participant || key.remoteJid;
        if (!participant || participant === sock.user?.id) return;

        // Rate limit: 1 status per 3 seconds
        if (Date.now() - lastStatusTime < 3000) return;
        lastStatusTime = Date.now();

        // Skip view-once if enabled
        const antiViewOnce = await db.get('antiViewOnce', false);
        if (antiViewOnce) {
            const isViewOnce =
                msg.message?.imageMessage?.viewOnce ||
                msg.message?.videoMessage?.viewOnce;
            if (isViewOnce) return;
        }

        // Auto view
        const autoView = await db.get('autoStatusView', true);
        if (!autoView) return;
        await sock.readMessages([key]);

        // Auto react
        const autoReact = await db.get('autoStatusReact', true);
        if (autoReact) {
            const emoji = randEmoji(config.statusEmojis);
            try {
                await sock.sendMessage('status@broadcast', {
                    react: { text: emoji, key }
                });
            } catch (error) {
                // Silent fail
            }
        }
    } catch (error) {
        // Silent fail
    }
}

// ============================================================
// 💝 CONNECTED MESSAGE (FIXED - SENDS TO CLEAN NUMBER JID)
// ============================================================

/**
 * 💝 Send Connected Message to Owner's WhatsApp Number
 * 
 * ✅ FIXED: Uses clean JID format (94762471350@s.whatsapp.net)
 * NOT the socket JID (94762471350:45@s.whatsapp.net)
 * 
 * Retries up to 5 times with increasing delays
 */
// ============================================================
// 💝 CONNECTED MESSAGE (WITH BOT LOGO IMAGE)
// ============================================================

/**
 * 💝 Send Connected Message with Bot Logo to Owner's WhatsApp
 * 
 * ✅ FIXED: Sends image + caption to clean number JID
 * Retries up to 5 times with increasing delays
 */
async function sendConnectedMessage(retryCount = 0) {
    // ---------- CHECK SOCKET ----------
    if (!sock) {
        console.log(`⏳ Connect msg attempt ${retryCount + 1}: No socket yet`);
        if (retryCount < 5) {
            setTimeout(() => sendConnectedMessage(retryCount + 1), 3000);
        }
        return;
    }

    // ---------- CHECK OWNER PHONE ----------
    if (!ownerPhone) {
        console.log(`⏳ Connect msg attempt ${retryCount + 1}: No owner phone yet`);
        if (retryCount < 5) {
            setTimeout(() => sendConnectedMessage(retryCount + 1), 3000);
        }
        return;
    }

    // ---------- BUILD CLEAN JID ----------
    const targetJid = ownerPhone + '@s.whatsapp.net';
    const device = ownerDeviceId || 'PRIMARY';
    const lid = ownerLid || 'N/A';

    console.log(`📨 Sending connect message with LOGO to: ${targetJid}`);

    // ---------- BUILD CAPTION ----------
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

    // ---------- SEND IMAGE + CAPTION ----------
    try {
        await sock.sendMessage(targetJid, {
            image: { url: BOT_LOGO },
            caption: captionText,
            mimetype: 'image/png'
        });
        console.log('✅ Connected message with LOGO sent successfully!');
        console.log(`   📱 Phone: ${ownerPhone}`);
        console.log(`   🔗 Device: ${device}`);
        console.log(`   🆔 LID: ${lid}`);
    } catch (error) {
        console.log(`❌ Connect msg attempt ${retryCount + 1} failed: ${error.message}`);

        // Retry with delay
        if (retryCount < 5) {
            const delay = (retryCount + 1) * 3000;
            console.log(`   Retrying in ${delay / 1000}s...`);
            setTimeout(() => sendConnectedMessage(retryCount + 1), delay);
        } else {
            console.log('❌ All connect message attempts failed');
            
            // Last attempt: send text only
            try {
                console.log('🔄 Final attempt: sending text only...');
                await sock.sendMessage(targetJid, { text: captionText });
                console.log('✅ Text-only connect message sent!');
            } catch (e) {
                console.log('❌ Even text-only failed');
            }
        }
    }
}
// ============================================================
// 💝 BEAUTIFUL MENUS
// ============================================================

/**
 * Send the beautiful main menu
 */
async function sendBeautifulMenu(sock, jid, db, config, owner, admin, isGroup, prefix) {
    const mode = await db.get('botMode', 'public');
    const modeEmoji = {
        private: '🔒',
        inbox: '📥',
        groups: '👥',
        public: '🌍'
    };

    // Build menu sections
    const menuLines = [];

    // ---------- HEADER ----------
    menuLines.push(
        '╭' + '─'.repeat(40) + '╮',
        '┃       💝 *NewsBot LK* 💝       ┃',
        '┃   🦄 ✨ *Sri Lanka\'s #1* ✨ 🦄   ┃',
        '┃     *WhatsApp News Bot*        ┃',
        '┃     ' + modeEmoji[mode] + ' Mode: ' + mode.toUpperCase() + '              ┃',
        '╰' + '─'.repeat(40) + '╯',
        ''
    );

    // ---------- NEWS CENTER ----------
    menuLines.push(
        sectionDivider('📰 NEWS CENTER', '📡'),
        '  ✦ ' + prefix + 'news       ─ Fetch Latest News',
        '  ✦ ' + prefix + 'stats      ─ Bot Statistics',
        ''
    );

    // ---------- MEDIA STUDIO ----------
    menuLines.push(
        sectionDivider('💾 MEDIA STUDIO', '📦'),
        '  ✦ ' + prefix + 'save       ─ Save Media Files',
        '  ✦ ' + prefix + 'vv         ─ Save View-Once',
        '  ✦ ' + prefix + 'status     ─ Status Info',
        ''
    );

    // ---------- GROUP TOOLS ----------
    menuLines.push(
        sectionDivider('👥 GROUP TOOLS', '👑'),
        '  ✦ ' + prefix + 'admins     ─ List Admins',
        '  ✦ ' + prefix + 'groupinfo  ─ Group Details',
        '  ✦ ' + prefix + 'tagall     ─ Mention All',
        '  ✦ ' + prefix + 'poll       ─ Create Poll',
        '  ✦ ' + prefix + 'afk        ─ Set AFK Status',
        ''
    );

    // ---------- ADMIN PANEL (if admin or owner) ----------
    if (admin || owner) {
        menuLines.push(
            sectionDivider('🛡️ ADMIN PANEL', '⚔️'),
            '  ✦ ' + prefix + 'mute/unmute    ─ Toggle Mute',
            '  ✦ ' + prefix + 'warn @user     ─ Warn Member (3=kick)',
            '  ✦ ' + prefix + 'kick @user     ─ Remove Member',
            '  ✦ ' + prefix + 'add 94xxxxxxx  ─ Add Member',
            '  ✦ ' + prefix + 'promote @user  ─ Make Admin',
            '  ✦ ' + prefix + 'demote @user   ─ Remove Admin',
            '  ✦ ' + prefix + 'voice on/off   ─ Voice Replies',
            '  ✦ ' + prefix + 'antilink on/off ─ Link Protection',
            '  ✦ ' + prefix + 'welcome on/off ─ Welcome Msg',
            '  ✦ ' + prefix + 'goodbye on/off ─ Goodbye Msg',
            '  ✦ ' + prefix + 'buttons on/off ─ Button Menu',
            ''
        );
    }

    // ---------- OWNER SUITE (if owner) ----------
    if (owner) {
        menuLines.push(
            sectionDivider('👑 OWNER SUITE', '💎'),
            '  ✦ ' + prefix + 'settings       ─ All Settings',
            '  ✦ ' + prefix + 'mode public    ─ Bot Mode',
            '  ✦ ' + prefix + 'autostatus on/off ─ Auto Status',
            '  ✦ ' + prefix + 'autonews on/off ─ Auto News',
            '  ✦ ' + prefix + 'autobio on/off ─ Auto Bio',
            '  ✦ ' + prefix + 'setprefix !    ─ Change Prefix',
            '  ✦ ' + prefix + 'broadcast msg  ─ Mass Message',
            '  ✦ ' + prefix + 'ban @user      ─ Ban User',
            '  ✦ ' + prefix + 'unban @user    ─ Unban User',
            '  ✦ ' + prefix + 'banlist        ─ Banned List',
            ''
        );
    }

    // ---------- VOICE COMMANDS ----------
    menuLines.push(
        sectionDivider('🎵 VOICE COMMANDS (DM)', '🎤'),
        '  gm ✦ gn ✦ hi ✦ ily ✦ bye',
        '  sad ✦ happy ✦ cry ✦ love',
        '  adarei ✦ kohomada ✦ pakaya',
        '  ...150+ Sinhala & English triggers!',
        ''
    );

    // ---------- FOOTER ----------
    menuLines.push(
        '━'.repeat(40),
        '🌐 ' + config.portfolio,
        '👨‍💻 ' + config.developer,
        '📦 Version: ' + config.version,
        '🔧 Prefix: "' + prefix + '"',
        '',
        beautifulFooter()
    );

    // Send with bot logo
    const caption = menuLines.join('\n');
    const sent = await sock.sendMessage(jid, {
        image: { url: BOT_LOGO },
        caption: caption,
        mimetype: 'image/png'
    });

    // Add reaction
    await sock.sendMessage(jid, {
        react: { text: '📋', key: sent.key }
    });
}

/**
 * Send beautiful settings panel
 */
async function sendBeautifulSettings(sock, jid, db, isOwnerCheck, config) {
    // Owner check
    if (!isOwnerCheck) {
        await sock.sendMessage(jid, {
            text: [
                '╭' + '─'.repeat(30) + '╮',
                '┃  ❌ *Owner Only!*  ┃',
                '╰' + '─'.repeat(30) + '╯',
                '',
                beautifulFooter()
            ].join('\n')
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
        '',

        // News
        sectionDivider('📰 NEWS', '📡'),
        '  ▸ Auto News: ' + statusBadge(settings.autoNewsEnabled),
        '',

        // Status
        sectionDivider('🖤 STATUS', '📱'),
        '  ▸ Auto View: ' + statusBadge(settings.autoStatusView),
        '  ▸ Auto React: ' + statusBadge(settings.autoStatusReact),
        '',

        // Security
        sectionDivider('🔒 SECURITY', '🛡️'),
        '  ▸ Anti-Link: ' + statusBadge(settings.antiLinkEnabled),
        '  ▸ Anti VV: ' + statusBadge(settings.antiViewOnce),
        '',

        // Voice
        sectionDivider('🎵 VOICE', '🎤'),
        '  ▸ Voice Replies: ' + statusBadge(settings.voiceReplyEnabled),
        '',

        // Display
        sectionDivider('📝 DISPLAY', '✨'),
        '  ▸ Auto Bio: ' + statusBadge(settings.autoBioEnabled),
        '  ▸ Button Menu: ' + statusBadge(settings.buttonMenuEnabled),
        '',

        // Group
        sectionDivider('👥 GROUP', '👑'),
        '  ▸ Welcome: ' + statusBadge(settings.welcomeEnabled),
        '  ▸ Goodbye: ' + statusBadge(settings.goodbyeEnabled),
        '',

        // System
        sectionDivider('🔧 SYSTEM', '⚙️'),
        '  ▸ Prefix: "' + (settings.prefix || '.') + '"',
        '  ▸ Mode: ' + modeEmoji[settings.botMode] + ' ' + (settings.botMode || 'public').toUpperCase(),
        '  ▸ Banned Users: ' + bans.length,
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

// ============================================================
// 🤖 MAIN BOT ENGINE
// ============================================================

async function startBot() {
    // Clean up existing connection
    if (sock) {
        try { sock.end(); } catch (error) {}
        sock = null;
    }

    // Import Baileys
    const baileys = await import('@whiskeysockets/baileys');
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason
    } = baileys;

    // Load saved authentication
    const { state, saveCreds } = await useMultiFileAuthState(
        path.join(__dirname, 'auth_info_baileys')
    );

    // Create WhatsApp socket
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

            // ---------- STATUS MESSAGES ----------
            if (jid === 'status@broadcast') {
                await handleStatus(msg);
                continue;
            }

            // Skip own messages in production
            if (msg.key.fromMe && !TEST_MODE) continue;

            // ---------- EXTRACT TEXT ----------
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

            // ---------- PARSE MESSAGE ----------
            const text = rawText.trim();
            const lower = text.toLowerCase();

            const sender = msg.key.participant || jid;
            const senderNum = sender.split('@')[0].replace(/[^0-9]/g, '');

            const isUserOwner = isOwner(senderNum, sender);
            const isGroupChat = jid.endsWith('@g.us');
            const isUserAdmin = isGroupChat ? await checkAdmin(jid, sender) : false;

            const prefix = await db.get('prefix', '.');
            const canToggle = isUserOwner || (isGroupChat && isUserAdmin);

            // Log commands
            if (lower.startsWith('.') || lower.startsWith(prefix)) {
                console.log(`📩 [${senderNum}] "${lower}"`);
            }

            // ---------- CHECK BOT MODE ACCESS ----------
            if (!await canUseBot(jid, isUserOwner)) {
                if (lower.startsWith(prefix) || lower.startsWith('.')) {
                    const mode = await db.get('botMode', 'public');
                    await sock.sendMessage(jid, {
                        text: [
                            '╭' + '─'.repeat(30) + '╮',
                            '┃  🔒 *' + mode.toUpperCase() + ' Mode!*  ┃',
                            '╰' + '─'.repeat(30) + '╯',
                            '',
                            beautifulFooter()
                        ].join('\n')
                    });
                }
                return;
            }

            // ---------- CHECK BAN ----------
            if (await db.banCheck(sender) && !isUserOwner) return;

            // ============================================================
            // 📋 MENU COMMAND
            // ============================================================
            if (lower === '.menu' || lower === `${prefix}menu` || lower === 'menu') {
                await sendBeautifulMenu(
                    sock, jid, db, config,
                    isUserOwner, isUserAdmin, isGroupChat, prefix
                );
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
                const settings = await db.all();
                const urlCount = await db.urlsCount();

                const statsText = [
                    '╭' + '─'.repeat(38) + '╮',
                    '┃         📊 *Statistics*           ┃',
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
                    '  🖤 Status React: ' + statusBadge(settings.autoStatusReact),
                    '  🎵 Voice: ' + statusBadge(settings.voiceReplyEnabled),
                    '  📝 Auto Bio: ' + statusBadge(settings.autoBioEnabled),
                    '',
                    '🔧 Prefix: "' + (settings.prefix || '.') + '"',
                    '',
                    beautifulFooter()
                ].join('\n');

                const sent = await sock.sendMessage(jid, { text: statsText });
                await sock.sendMessage(jid, { react: { text: '📊', key: sent.key } });
                return;
            }

            // ============================================================
            // 📰 NEWS COMMAND
            // ============================================================
            if (lower === '.news' || lower === `${prefix}news` || lower === 'news') {
                const autoNewsEnabled = await db.get('autoNewsEnabled', true);

                if (!autoNewsEnabled && !isUserOwner) {
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
            // 🔘 TOGGLE COMMANDS
            // ============================================================
            if (canToggle) {
                // Define all toggle commands
                const toggles = {
                    'voice on':    ['voiceReplyEnabled', true,  '🎵 *Voice: ON* ✅'],
                    'voice off':   ['voiceReplyEnabled', false, '🎵 *Voice: OFF* ❌'],
                    'buttons on':  ['buttonMenuEnabled', true,  '🔘 *Buttons: ON* ✅'],
                    'buttons off': ['buttonMenuEnabled', false, '📋 *Text Menu: ON* ✅'],
                    'antilink on': ['antiLinkEnabled', true,  '🔗 *Anti-Link: ON* ✅'],
                    'antilink off':['antiLinkEnabled', false, '🔗 *Anti-Link: OFF* ❌'],
                    'welcome on':  ['welcomeEnabled', true,  '👋 *Welcome: ON* ✅'],
                    'welcome off': ['welcomeEnabled', false, '👋 *Welcome: OFF* ❌'],
                    'goodbye on':  ['goodbyeEnabled', true,  '👋 *Goodbye: ON* ✅'],
                    'goodbye off': ['goodbyeEnabled', false, '👋 *Goodbye: OFF* ❌'],
                    'autobio on':  ['autoBioEnabled', true,  '📝 *Auto Bio: ON* ✅'],
                    'autobio off': ['autoBioEnabled', false, '📝 *Auto Bio: OFF* ❌'],
                };

                // Check each toggle
                for (const [cmd, [key, val, responseMsg]] of Object.entries(toggles)) {
                    if (lower === '.' + cmd || lower === prefix + cmd) {
                        await db.set(key, val);
                        await sock.sendMessage(jid, {
                            text: responseMsg + beautifulFooter()
                        });
                        return;
                    }
                }
            }

            // ============================================================
            // 🎤 VOICE REPLIES (DM only, non-owner)
            // ============================================================
            if (
                !isGroupChat &&
                !isUserOwner &&
                await db.get('voiceReplyEnabled', true) &&
                voiceClips?.replies
            ) {
                for (const [trigger, url] of Object.entries(voiceClips.replies)) {
                    const words = lower.split(/\s+/);

                    // Match trigger
                    const isMatch =
                        lower === trigger ||
                        words.includes(trigger) ||
                        (trigger.includes(' ') && lower.includes(trigger));

                    if (isMatch) {
                        try {
                            const response = await axios.get(url, {
                                responseType: 'arraybuffer',
                                timeout: 20000
                            });

                            const buffer = Buffer.from(response.data);

                            if (buffer.length > 100) {
                                const sent = await sock.sendMessage(
                                    jid,
                                    {
                                        audio: buffer,
                                        mimetype: 'audio/mpeg',
                                        ptt: true
                                    },
                                    { quoted: msg }
                                );

                                await sock.sendMessage(jid, {
                                    react: { text: '🎵', key: sent.key }
                                });
                            }
                        } catch (error) {
                            // Silent fail for voice replies
                        }
                        return;
                    }
                }
            }

            // ============================================================
            // 👑 OWNER COMMANDS
            // ============================================================
            if (isUserOwner) {

                // ----- MODE -----
                if (lower === '.mode' || lower.startsWith('.mode ')) {
                    const modeArg = text
                        .replace('.mode', '')
                        .trim()
                        .toLowerCase();

                    const validModes = ['private', 'inbox', 'groups', 'public'];
                    const modeEmoji = {
                        private: '🔒',
                        inbox: '📥',
                        groups: '👥',
                        public: '🌍'
                    };

                    if (validModes.includes(modeArg)) {
                        await db.set('botMode', modeArg);
                        await sock.sendMessage(jid, {
                            text: modeEmoji[modeArg] +
                                  ' *Mode: ' + modeArg.toUpperCase() +
                                  '*\n\n' + beautifulFooter()
                        });
                    } else {
                        const currentMode = await db.get('botMode', 'public');
                        await sock.sendMessage(jid, {
                            text: modeEmoji[currentMode] +
                                  ' *Current: ' + currentMode.toUpperCase() +
                                  '*\n💡 .mode private/inbox/groups/public\n\n' +
                                  beautifulFooter()
                        });
                    }
                    return;
                }

                // ----- AUTO STATUS -----
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

                // ----- AUTO NEWS -----
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

                // ----- SET PREFIX -----
                if (lower.startsWith('.setprefix ')) {
                    const newPrefix = text.replace('.setprefix', '').trim();
                    if (newPrefix.length >= 1 && newPrefix.length <= 3) {
                        await db.set('prefix', newPrefix);
                        await sock.sendMessage(jid, {
                            text: '🔧 *Prefix: "' + newPrefix +
                                  '"*\n💡 Use *' + newPrefix + 'menu*\n\n' +
                                  beautifulFooter()
                        });
                    }
                    return;
                }

                // ----- BROADCAST -----
                if (lower.startsWith('.broadcast ')) {
                    const broadcastMsg = text.replace('.broadcast', '').trim();

                    try {
                        const groups = await sock.groupFetchAllParticipating();
                        let count = 0;

                        for (const groupId of Object.keys(groups)) {
                            try {
                                await sock.sendMessage(groupId, {
                                    text: '📢 *Broadcast*\n\n' +
                                          broadcastMsg + '\n\n' +
                                          beautifulFooter()
                                });
                                count++;
                                await new Promise(r => setTimeout(r, 1000));
                            } catch (error) {
                                // Skip failed groups
                            }
                        }

                        await sock.sendMessage(jid, {
                            text: '📢 Sent to *' + count + '* groups!' +
                                  beautifulFooter()
                        });
                    } catch (error) {
                        // Silent fail
                    }
                    return;
                }

                // ----- BAN -----
                if (lower.startsWith('.ban ')) {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (mentioned?.length) {
                        await db.banAdd(mentioned[0]);
                        await sock.sendMessage(jid, {
                            text: '🚫 @' + mentioned[0].split('@')[0] +
                                  ' *banned!*\n\n' + beautifulFooter(),
                            mentions: [mentioned[0]]
                        });
                    }
                    return;
                }

                // ----- UNBAN -----
                if (lower.startsWith('.unban ')) {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (mentioned?.length) {
                        await db.banRemove(mentioned[0]);
                        await sock.sendMessage(jid, {
                            text: '✅ @' + mentioned[0].split('@')[0] +
                                  ' *unbanned!*\n\n' + beautifulFooter(),
                            mentions: [mentioned[0]]
                        });
                    }
                    return;
                }

                // ----- BAN LIST -----
                if (lower === '.banlist' || lower === `${prefix}banlist`) {
                    const bans = await db.banAll();

                    if (!bans.length) {
                        await sock.sendMessage(jid, {
                            text: '✅ *No bans!*' + beautifulFooter()
                        });
                    } else {
                        const banList = bans
                            .map((b, i) => (i + 1) + '. @' + b.userId.split('@')[0])
                            .join('\n');

                        await sock.sendMessage(jid, {
                            text: '🚫 *Banned (' + bans.length + ')*\n' +
                                  banList + '\n\n' + beautifulFooter(),
                            mentions: bans.map(b => b.userId)
                        });
                    }
                    return;
                }
            }

            // ============================================================
            // 👥 GROUP COMMANDS
            // ============================================================
            if (isGroupChat) {

                // ----- ADMINS LIST -----
                if (lower === '.admins' || lower === `${prefix}admins`) {
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const admins = metadata.participants.filter(p => p.admin);
                        const adminList = admins
                            .map(p => '👑 @' + p.id.split('@')[0])
                            .join('\n');

                        const sent = await sock.sendMessage(jid, {
                            text: '👑 *Admins*\n' + adminList + '\n\n' + beautifulFooter(),
                            mentions: admins.map(p => p.id)
                        });
                        await sock.sendMessage(jid, {
                            react: { text: '👑', key: sent.key }
                        });
                    } catch (error) {}
                    return;
                }

                // ----- GROUP INFO -----
                if (
                    lower === '.groupinfo' ||
                    lower === `${prefix}groupinfo` ||
                    lower === '.gcinfo'
                ) {
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const sent = await sock.sendMessage(jid, {
                            text: '📋 *' + metadata.subject +
                                  '*\n👥 ' + metadata.participants.length +
                                  '\n👑 @' + metadata.owner?.split('@')[0] +
                                  '\n\n' + beautifulFooter(),
                            mentions: [metadata.owner]
                        });
                        await sock.sendMessage(jid, {
                            react: { text: '📋', key: sent.key }
                        });
                    } catch (error) {}
                    return;
                }

                // ----- TAG ALL -----
                if (
                    lower === '.tagall' ||
                    lower === `${prefix}tagall` ||
                    lower === '.everyone'
                ) {
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const sent = await sock.sendMessage(jid, {
                            text: '📢 *Everyone!*\n\n' + beautifulFooter(),
                            mentions: metadata.participants.map(p => p.id)
                        });
                        await sock.sendMessage(jid, {
                            react: { text: '📢', key: sent.key }
                        });
                    } catch (error) {}
                    return;
                }

                // ----- POLL -----
                if (lower.startsWith('.poll ')) {
                    const question = text.replace('.poll', '').trim();
                    const sent = await sock.sendMessage(jid, {
                        poll: {
                            name: '📊 ' + question,
                            values: ['👍 Yes', '👎 No', '🤔 Maybe'],
                            selectableCount: 1
                        }
                    });
                    await sock.sendMessage(jid, {
                        react: { text: '📊', key: sent.key }
                    });
                    return;
                }

                // ----- AFK -----
                if (lower.startsWith('.afk')) {
                    const reason = text.replace('.afk', '').trim() || 'AFK';
                    await db.afkSet(sender, reason);

                    const sent = await sock.sendMessage(jid, {
                        text: '💤 @' + sender.split('@')[0] +
                              ' *AFK:* ' + reason + '\n\n' + beautifulFooter(),
                        mentions: [sender]
                    });
                    await sock.sendMessage(jid, {
                        react: { text: '💤', key: sent.key }
                    });
                    return;
                }

                // ============================================================
                // 🛡️ ADMIN COMMANDS
                // ============================================================
                if (isUserAdmin || isUserOwner) {

                    // ----- MUTE -----
                    if (lower === '.mute' || lower === `${prefix}mute`) {
                        await db.groupSet(jid, 'isMuted', true);
                        await sock.sendMessage(jid, {
                            text: '🔇 *Muted 30min*\n\n' + beautifulFooter()
                        });
                        setTimeout(() => {
                            db.groupSet(jid, 'isMuted', false);
                        }, 30 * 60 * 1000);
                        return;
                    }

                    // ----- UNMUTE -----
                    if (lower === '.unmute' || lower === `${prefix}unmute`) {
                        await db.groupSet(jid, 'isMuted', false);
                        await sock.sendMessage(jid, {
                            text: '🔊 *Unmuted!*\n\n' + beautifulFooter()
                        });
                        return;
                    }

                    // ----- WARN -----
                    if (lower.startsWith('.warn ')) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            const count = await db.warnAdd(mentioned[0], jid);
                            await sock.sendMessage(jid, {
                                text: '⚠️ @' + mentioned[0].split('@')[0] +
                                      ' (*' + count + '/3*)\n\n' + beautifulFooter(),
                                mentions: [mentioned[0]]
                            });

                            // Auto-kick at 3 warnings
                            if (count >= 3) {
                                try {
                                    await sock.groupParticipantsUpdate(
                                        jid,
                                        [mentioned[0]],
                                        'remove'
                                    );
                                    await db.warnClear(mentioned[0], jid);
                                } catch (error) {}
                            }
                        }
                        return;
                    }

                    // ----- KICK -----
                    if (lower.startsWith('.kick ')) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            try {
                                await sock.groupParticipantsUpdate(
                                    jid,
                                    [mentioned[0]],
                                    'remove'
                                );
                                await sock.sendMessage(jid, {
                                    text: '🚫 @' + mentioned[0].split('@')[0] +
                                          ' *kicked!*\n\n' + beautifulFooter(),
                                    mentions: [mentioned[0]]
                                });
                            } catch (error) {}
                        }
                        return;
                    }

                    // ----- ADD -----
                    if (lower.startsWith('.add ')) {
                        const number = text
                            .replace('.add', '')
                            .trim()
                            .replace(/[^0-9]/g, '');

                        if (number) {
                            try {
                                await sock.groupParticipantsUpdate(
                                    jid,
                                    [number + '@s.whatsapp.net'],
                                    'add'
                                );
                                await sock.sendMessage(jid, {
                                    text: '✅ *' + number +
                                          ' added!*\n\n' + beautifulFooter()
                                });
                            } catch (error) {}
                        }
                        return;
                    }

                    // ----- PROMOTE -----
                    if (lower.startsWith('.promote ')) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            try {
                                await sock.groupParticipantsUpdate(
                                    jid,
                                    [mentioned[0]],
                                    'promote'
                                );
                                await sock.sendMessage(jid, {
                                    text: '👑 @' + mentioned[0].split('@')[0] +
                                          ' *promoted!*\n\n' + beautifulFooter(),
                                    mentions: [mentioned[0]]
                                });
                            } catch (error) {}
                        }
                        return;
                    }

                    // ----- DEMOTE -----
                    if (lower.startsWith('.demote ')) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            try {
                                await sock.groupParticipantsUpdate(
                                    jid,
                                    [mentioned[0]],
                                    'demote'
                                );
                                await sock.sendMessage(jid, {
                                    text: '⬇️ @' + mentioned[0].split('@')[0] +
                                          ' *demoted!*\n\n' + beautifulFooter(),
                                    mentions: [mentioned[0]]
                                });
                            } catch (error) {}
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
                        key: {
                            remoteJid: jid,
                            id: contextInfo.stanzaId
                        },
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
                            await sock.sendMessage(jid, {
                                sticker: saved.buffer
                            });
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
                        text: '💡 Reply to media with *' + prefix + 'save*\n\n' +
                              beautifulFooter()
                    });
                }
                return;
            }

            // ============================================================
            // 👁️ VIEW-ONCE SAVER
            // ============================================================
            if (lower === '.vv' || lower === `${prefix}vv` || lower === 'vv') {
                const contextInfo = msg.message?.extendedTextMessage?.contextInfo;

                const isViewOnce =
                    contextInfo?.quotedMessage?.imageMessage?.viewOnce ||
                    contextInfo?.quotedMessage?.videoMessage?.viewOnce;

                if (isViewOnce) {
                    const fakeMessage = {
                        key: {
                            remoteJid: jid,
                            id: contextInfo.stanzaId,
                            participant: contextInfo.participant
                        },
                        message: contextInfo.quotedMessage
                    };

                    const saved = await saveMediaToFile(fakeMessage, VV_FOLDER);

                    // Send to owner using CLEAN JID
                    if (saved && cleanOwnerJid) {
                        const caption = '📱 *VV Saved!*\n👤 @' +
                            sender.split('@')[0] + '\n\n' + beautifulFooter();

                        try {
                            if (saved.type === 'imageMessage') {
                                await sock.sendMessage(cleanOwnerJid, {
                                    image: saved.buffer,
                                    caption: caption,
                                    mentions: [sender]
                                });
                            } else if (saved.type === 'videoMessage') {
                                await sock.sendMessage(cleanOwnerJid, {
                                    video: saved.buffer,
                                    caption: caption,
                                    mentions: [sender]
                                });
                            }
                        } catch (error) {}
                    }

                    await sock.sendMessage(jid, {
                        text: saved
                            ? '✅ *Saved!* 📥\n\n' + beautifulFooter()
                            : '❌ *Failed!*\n\n' + beautifulFooter()
                    });
                } else {
                    await sock.sendMessage(jid, {
                        text: '💡 Reply to VV with *' + prefix + 'vv*\n\n' +
                              beautifulFooter()
                    });
                }
                return;
            }

            // ============================================================
            // 🔗 ANTI-LINK DETECTION
            // ============================================================
            const hasBannedLink = /https?:\/\/(?:chat\.whatsapp\.com|t\.me|discord\.gg)/i.test(text);
            const antiLinkEnabled = await db.get('antiLinkEnabled', false);

            if (
                isGroupChat &&
                antiLinkEnabled &&
                hasBannedLink &&
                !isUserAdmin &&
                !isUserOwner
            ) {
                try {
                    await sock.sendMessage(jid, { delete: msg.key });
                } catch (error) {}

                await sock.sendMessage(jid, {
                    text: '🔗 *Link Deleted!*\n👤 @' +
                          sender.split('@')[0] + '\n\n' + beautifulFooter(),
                    mentions: [sender]
                });
                return;
            }

            // ============================================================
            // 💤 AFK DETECTION
            // ============================================================
            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

            if (mentionedJids) {
                for (const mentioned of mentionedJids) {
                    const afkData = await db.afkGet(mentioned);

                    if (afkData) {
                        const minutes = Math.floor(
                            (Date.now() - new Date(afkData.afkAt).getTime()) / 60000
                        );

                        await sock.sendMessage(jid, {
                            text: '💤 @' + mentioned.split('@')[0] +
                                  ' *AFK:* ' + afkData.reason +
                                  ' (' + minutes + 'm)\n\n' + beautifulFooter(),
                            mentions: [mentioned]
                        });
                    }
                }
            }

            // Auto-remove AFK when user sends a message
            const isAfkCommand = lower.startsWith('.afk') || lower.startsWith(`${prefix}afk`);

            if (await db.afkGet(sender) && !isAfkCommand) {
                await db.afkRemove(sender);
            }
        }
    });

    // ============================================================
    // 👥 GROUP PARTICIPANT UPDATES
    // ============================================================
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {

        // ----- WELCOME MESSAGE -----
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

        // ----- GOODBYE MESSAGE -----
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
    // 🔌 CONNECTION UPDATES (WITH LID & RETRY CONNECT MSG)
    // ============================================================
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {

        // ---------- SHOW QR CODE ----------
        if (qr) {
            console.log('\n📱 Scan QR Code to connect:\n');
            qrcode.generate(qr, { small: true });
        }

        // ---------- CONNECTION CLOSED ----------
        if (connection === 'close') {
            isConnected = false;
            sock = null;

            const statusCode = lastDisconnect?.error?.output?.statusCode;

            if (statusCode !== DisconnectReason.loggedOut && !isShuttingDown) {
                reconnectAttempts++;
                console.log(`\n🔄 Reconnecting... Attempt ${reconnectAttempts}\n`);

                const delay = Math.min(30000, 5000 * reconnectAttempts);
                reconnectTimer = setTimeout(async () => {
                    reconnectTimer = null;
                    await startBot();
                }, delay);
            } else {
                console.log('\n❌ Logged out! Please re-scan QR code.\n');
            }
        }

        // ---------- CONNECTION OPENED ----------
        else if (connection === 'open') {
            isConnected = true;
            reconnectAttempts = 0;

            // Save owner information
            if (sock.user) {
                ownerJid = sock.user.id;
                ownerPhone = ownerJid.split(':')[0].split('@')[0];
                ownerDeviceId = ownerJid.includes(':')
                    ? ownerJid.split(':')[1].split('@')[0]
                    : 'PRIMARY';
                ownerLid = sock.user.lid || 'N/A';

                // ✅ BUILD CLEAN JID FOR SENDING MESSAGES
                cleanOwnerJid = ownerPhone + '@s.whatsapp.net';

                // Print connection info
                console.log('\n' + '═'.repeat(50));
                console.log('  💝 NewsBot LK - Connected! 💝');
                console.log('═'.repeat(50));
                console.log(`  👑 Owner JID  : ${ownerJid}`);
                console.log(`  📱 Phone      : ${ownerPhone}`);
                console.log(`  🔗 Device ID  : ${ownerDeviceId}`);
                console.log(`  🆔 LID        : ${ownerLid}`);
                console.log(`  📨 Clean JID  : ${cleanOwnerJid}`);
                console.log(`  🗄️ Database   : ${useJsonFallback ? 'JSON' : 'MongoDB'}`);
                console.log(`  🦄 Version    : v${config.version}`);
                console.log('═'.repeat(50) + '\n');
            }

            // ✅ Send connected message with retry logic
            // Uses clean JID (94762471350@s.whatsapp.net)
            setTimeout(() => {
                sendConnectedMessage(0);
            }, 5000);

            // Start news after delay
            setTimeout(async () => {
                if (await db.get('autoNewsEnabled', true)) {
                    await checkAndShareAllNewNews();
                }
            }, 10000);

            // Update bio after delay
            setTimeout(async () => {
                await updateBotBio();
            }, 15000);
        }
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);
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

        // Extract article content
        let description = '';
        const articlePatterns = [
            /<div[^>]*class="[^"]*news-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<article[^>]*>([\s\S]*?)<\/article>/i
        ];

        for (const pattern of articlePatterns) {
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

        // Fallback: extract all paragraphs
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
    } catch (error) {
        return { description: '', image: '' };
    }
}

/**
 * Fetch news from Hiru
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
        } catch (error) {
            // Skip failed categories
        }
    }

    return newsItems;
}

/**
 * Fetch news from Derana
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
    } catch (error) {
        // Silent fail
    }

    return newsItems;
}

/**
 * Fetch news from RSS feed
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
    } catch (error) {
        // Silent fail
    }

    return newsItems;
}

/**
 * Fetch all latest news from all sources
 */
async function fetchAllLatestNews() {
    const sources = [
        { name: 'Hiru', fetch: fetchHiruNews },
        { name: 'Derana', fetch: fetchDeranaNews },
        {
            name: 'AdaDerana',
            fetch: () => fetchRSS(
                'https://www.adaderana.lk/rss.php',
                '📰 AdaDerana'
            )
        },
        {
            name: 'Cricket',
            fetch: () => fetchRSS(
                'https://www.espncricinfo.com/rss/content/story/feeds/8.xml',
                '🏏 ESPN Cricinfo',
                2
            )
        },
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
                } catch (error) {}
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
                } catch (error) {}
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
                } catch (error) {}
                return [];
            }
        }
    ];

    // Fetch all sources in parallel
    const results = await Promise.allSettled(sources.map(s => s.fetch()));

    // Collect successful results
    const allNews = [];
    sources.forEach((source, index) => {
        if (
            results[index].status === 'fulfilled' &&
            Array.isArray(results[index].value) &&
            results[index].value.length > 0
        ) {
            allNews.push(...results[index].value);
        }
    });

    // Deduplicate by URL
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
 * Send a news article to a chat
 */
async function sendNews(jid, article) {
    if (!sock?.user) return false;

    const description = truncate(
        (article.description || article.title || '').trim(),
        5000
    );

    // Format description with better line breaks
    const formattedDesc = description
        .split('\n\n')
        .map(para => para.trim())
        .filter(para => para.length > 0)
        .join('\n\n');

    // Build beautiful news caption
    const caption = [
        '',
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
    ].filter(line => line !== '').join('\n');

    try {
        let sent;

        // Try sending with article image
        if (article.image?.length > 10) {
            try {
                sent = await sock.sendMessage(jid, {
                    image: { url: article.image },
                    caption: caption,
                    mimetype: 'image/jpeg'
                });
            } catch (error) {
                // Image failed, use bot logo
            }
        }

        // Fallback to bot logo
        if (!sent) {
            sent = await sock.sendMessage(jid, {
                image: { url: BOT_LOGO },
                caption: caption,
                mimetype: 'image/png'
            });
        }

        // Add reaction
        await sock.sendMessage(jid, {
            react: {
                text: randEmoji(REACTIONS),
                key: sent.key
            }
        });

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Check for new news and share to group
 */
async function checkAndShareAllNewNews() {
    if (!sock?.user) return;

    // Check if group is muted
    const isMuted = await db.groupGet(NEWS_GROUP_JID, 'isMuted', false);
    if (isMuted) {
        console.log('🔇 News group is muted, skipping...');
        return;
    }

    try {
        const allNews = await fetchAllLatestNews();
        if (!allNews.length) return;

        const sentUrls = await db.urlsGet();

        // First run: just save URLs without sending
        if (!sentUrls.length) {
            for (const article of allNews) {
                if (article.url) {
                    await db.urlsAdd(article.url);
                }
            }
            console.log(`📰 Initialized URL database with ${allNews.length} articles`);
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

            // Rate limit between messages
            await new Promise(r => setTimeout(r, 3000));
        }

        if (sharedCount > 0) {
            console.log(`📰 Shared ${sharedCount} new articles`);
        }
    } catch (error) {
        console.error('❌ News check failed:', error.message);
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
    console.log('  👨‍💻 Developer : ' + config.developer);
    console.log('  👑 Owners    : ' + OWNER_NUMBERS.join(', '));
    console.log('  🌐 Portfolio : ' + config.portfolio);
    console.log('═'.repeat(50));
    console.log('  💝 Dedicated to:');
    console.log('  🌸 Umesha Sathyanjali');
    console.log('  🌸 Mithila');
    console.log('  🌸 Sharada');
    console.log('═'.repeat(50) + '\n');

    // Connect to database
    await connectDatabase();

    // Start the bot
    await startBot();

    // Auto news interval
    setInterval(async () => {
        if (await db.get('autoNewsEnabled', true)) {
            await checkAndShareAllNewNews();
        }
    }, CHECK_INTERVAL_MS);

    // Auto bio interval (every 30 minutes)
    setInterval(async () => {
        await updateBotBio();
    }, 30 * 60 * 1000);

    console.log('🦄💝 NewsBot LK is running! 💝🦄\n');
})();
