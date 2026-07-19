// ============================================
// 💝 NewsBot LK v9.0.0 - Beautiful Edition
// 👨‍💻 Developed by Charuka Mahesh
// 💛 Dedicated to Umesha Sathyanjali | Mithila | Sharada
// 🌐 https://charukamahesh922-collab.github.io/protifilo/
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

// 🧹 Cleanup
try { 
    if (fs.existsSync(path.join(__dirname, 'app.pid'))) {
        fs.unlinkSync(path.join(__dirname, 'app.pid'));
    }
} catch (e) {}
console.log('🧹 Cleanup complete');

// ═══════════════════════════════════════
// 📦 CONFIGURATION
// ═══════════════════════════════════════
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

// Create folders
[SAVE_FOLDER, STATUS_FOLDER, VV_FOLDER].forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
});

// ═══════════════════════════════════════
// 🗄️ JSON DATABASE (Fallback)
// ═══════════════════════════════════════
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

// ═══════════════════════════════════════
// 🍃 MONGOOSE SCHEMAS
// ═══════════════════════════════════════
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

// ═══════════════════════════════════════
// 🔌 DATABASE CONNECTION
// ═══════════════════════════════════════
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
                dbName: config.dbName,
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                ssl: false,
                tls: false,
                retryWrites: false
            });

            Setting = mongoose.model('Setting', settingSchema);
            Warning = mongoose.model('Warning', warningSchema);
            Ban = mongoose.model('Ban', banSchema);
            Afk = mongoose.model('Afk', afkSchema);
            GroupSetting = mongoose.model('GroupSetting', groupSettingSchema);

            // Initialize default settings
            if (await Setting.countDocuments() === 0) {
                for (const [key, value] of Object.entries(config.defaults)) {
                    await Setting.create({ key, value });
                }
            }

            console.log('✅ Mongoose Connected');
            return true;

        } catch (e) {
            console.error('❌ MongoDB Connection Failed:', e.message);
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

// ═══════════════════════════════════════
// 🗃️ DATABASE OPERATIONS
// ═══════════════════════════════════════
const db = {
    isJson: () => useJsonFallback,

    // Settings
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

    all: async () => {
        if (useJsonFallback) {
            return { ...config.defaults, ...jsonDb.settings };
        }
        try {
            const docs = await Setting.find({});
            const settings = {};
            docs.forEach(doc => {
                settings[doc.key] = doc.value;
            });
            return { ...config.defaults, ...settings };
        } catch {
            return { ...config.defaults };
        }
    },

    // Warnings
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

    // Bans
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
        if (useJsonFallback) {
            return jsonDb.bans;
        }
        try {
            return await Ban.find({});
        } catch {
            return [];
        }
    },

    // AFK
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
        if (useJsonFallback) {
            return jsonDb.afk[userId] || null;
        }
        try {
            return await Afk.findOne({ userId });
        } catch {
            return null;
        }
    },

    // Group Settings
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

    // URL Tracking
    urlsGet: async () => {
        if (useJsonFallback) {
            return jsonDb.sentUrls || [];
        }
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
        if (useJsonFallback) {
            return jsonDb.sentUrls.length;
        }
        try {
            const doc = await Setting.findOne({ key: 'sentUrls' });
            return doc?.value?.length || 0;
        } catch {
            return 0;
        }
    }
};

// ═══════════════════════════════════════
// 🎨 BEAUTIFUL UI HELPERS
// ═══════════════════════════════════════

// Beautiful borders and dividers
const BORDERS = {
    single: '━',
    double: '═',
    dashed: '┄',
    dotted: '┅',
    star: '✧',
    heart: '♥',
    sparkle: '✦'
};

const EMOJIS = {
    bot: '🦄',
    crown: '👑',
    star: '⭐',
    sparkle: '✨',
    heart: '💝',
    fire: '🔥',
    news: '📰',
    settings: '⚙️',
    menu: '📋',
    stats: '📊',
    media: '💾',
    voice: '🎵',
    lock: '🔒',
    unlock: '🔓',
    check: '✅',
    cross: '❌',
    warn: '⚠️',
    ban: '🚫',
    admin: '🛡️',
    group: '👥',
    world: '🌍',
    robot: '🤖',
    rocket: '🚀',
    mail: '📨',
    save: '💾',
    eye: '👁️',
    muted: '🔇',
    unmuted: '🔊',
    link: '🔗',
    afk: '💤',
    bio: '📝',
    wave: '👋',
    party: '🎉',
    sad: '😢'
};

// Beautiful footer
const beautifulFooter = () => {
    return [
        '',
        `${'━'.repeat(25)}`,
        `🦄💝 *\`NewsBot LK | Charuka Mahesh\`* 💝🦄`,
        `💝 *\`Umesha Sathyanjali & Mithila Sharada\`* 💝`,
        ''
    ].join('\n');
};

// Beautiful header
const beautifulHeader = (title = 'NewsBot LK') => {
    return [
        `╭${'─'.repeat(30)}╮`,
        `┃     💝 *${title}* 💝`,
        `┃     🦄 v${config.version}`,
        `╰${'─'.repeat(30)}╯`,
        ''
    ].join('\n');
};

// Section divider
const sectionDivider = (title, emoji = '✦') => {
    const line = '─'.repeat(10);
    return `\n${emoji} ${line} *${title}* ${line} ${emoji}\n`;
};

// Status badge
const statusBadge = (enabled) => enabled ? '✅ *ON*' : '❌ *OFF*';

// Clean text
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

// Smart truncate
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
    return lastSpace > maxLength * 0.7
        ? shortened.substring(0, lastSpace).trim() + '...'
        : shortened.trim() + '...';
};

// Random emoji
const randomEmoji = (array) => array[Math.floor(Math.random() * array.length)];

// ═══════════════════════════════════════
// 🔐 AUTH & PERMISSIONS
// ═══════════════════════════════════════
let sock = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let isConnected = false;
let isShuttingDown = false;
let lastStatusTime = 0;
let ownerJid = null;

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

async function canUseBot(jid, isUserOwner) {
    if (isUserOwner) return true;
    
    const mode = await db.get('botMode', 'public');
    const isGroup = jid.endsWith('@g.us');
    
    switch (mode) {
        case 'private':
            return false;
        case 'inbox':
            return !isGroup;
        case 'groups':
            return isGroup;
        default:
            return true;
    }
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

// ═══════════════════════════════════════
// 📥 MEDIA HANDLERS
// ═══════════════════════════════════════
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

// ═══════════════════════════════════════
// 📝 AUTO BIO UPDATER
// ═══════════════════════════════════════
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
        console.log('📝 Bio updated');
    } catch (e) {
        console.error('❌ Bio update failed:', e.message);
    }
}

// ═══════════════════════════════════════
// 📱 STATUS HANDLER
// ═══════════════════════════════════════
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

        // Anti view-once
        if (
            await db.get('antiViewOnce', false) &&
            (msg.message?.imageMessage?.viewOnce || msg.message?.videoMessage?.viewOnce)
        ) return;

        // Auto view
        if (!await db.get('autoStatusView', true)) return;
        await sock.readMessages([key]);

        // Auto react
        if (await db.get('autoStatusReact', true)) {
            const emoji = randomEmoji(config.statusEmojis);
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

// ═══════════════════════════════════════
// 🎀 BEAUTIFUL MENUS
// ═══════════════════════════════════════

// 💝 Beautiful Connected Message
async function sendConnectedMessage() {
    if (!ownerJid) return;
    
    const message = [
        beautifulHeader(`${config.botName}`),
        '',
        `✨ *Bot Successfully Connected!* ✨`,
        '',
        `🦄💝 *\`NewsBot LK\`* 💝🦄`,
        `💝 *\`Charuka Mahesh\`* 💝`,
        '',
        `${'━'.repeat(25)}`,
        '',
        `${EMOJIS.check} *Status: Connected*`,
        `${EMOJIS.heart} *Status React: ${statusBadge(await db.get('autoStatusReact', true))}*`,
        `${EMOJIS.menu} *.menu: Show Menu*`,
        `${EMOJIS.settings} *.settings: Settings*`,
        '',
        `${'━'.repeat(25)}`,
        '',
        `💝 *\`Dedicated to:\`*`,
        `🌸 *Umesha Sathyanjali*`,
        `🌸 *Mithila*`,
        `🌸 *Sharada*`,
        '',
        `🦄💝 *\`NewsBot LK | Charuka Mahesh\`* 💝🦄`,
        ''
    ].join('\n');

    try {
        await sock.sendMessage(ownerJid, {
            image: { url: BOT_LOGO },
            caption: message,
            mimetype: 'image/png'
        });
    } catch (e) {
        console.error('❌ Failed to send connected message');
    }
}

// Native WhatsApp Buttons
async function sendNativeButtons(sock, jid, db, config, owner, admin, prefix) {
    const mode = await db.get('botMode', 'public');
    const modeEmojis = {
        private: '🔒',
        inbox: '📥',
        groups: '👥',
        public: '🌍'
    };

    const buttons = [
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "📰 News",
                id: "btn_news"
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "📋 Full Menu",
                id: "btn_menu"
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "⚙️ Settings",
                id: "btn_settings"
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "💾 Save Media",
                id: "btn_save"
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "📥 View-Once",
                id: "btn_vv"
            })
        }
    ];

    if (admin || owner) {
        buttons.push(
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🎵 Voice ON",
                    id: "btn_voice_on"
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🎵 Voice OFF",
                    id: "btn_voice_off"
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🔗 AntiLink ON",
                    id: "btn_antilink_on"
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🔇 Mute",
                    id: "btn_mute"
                })
            }
        );
    }

    if (owner) {
        buttons.push(
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🖤 Auto Status",
                    id: "btn_autostatus_on"
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "📝 Auto Bio",
                    id: "btn_autobio_on"
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🌍 Public Mode",
                    id: "btn_mode_public"
                })
            }
        );
    }

    try {
        const baileys = await import('@whiskeysockets/baileys');
        const message = baileys.generateWAMessageFromContent(
            jid,
            {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {},
                        interactiveMessage: baileys.proto.Message.InteractiveMessage.create({
                            body: baileys.proto.Message.InteractiveMessage.Body.create({
                                text: [
                                    `💝 *${config.botName}* v${config.version}`,
                                    `${modeEmojis[mode]} Mode: ${mode.toUpperCase()}`,
                                    '',
                                    `📋 Choose an option:`
                                ].join('\n')
                            }),
                            footer: baileys.proto.Message.InteractiveMessage.Footer.create({
                                text: "🦄💝 NewsBot LK | Charuka Mahesh 💝🦄"
                            }),
                            nativeFlowMessage: baileys.proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: buttons
                            })
                        })
                    }
                }
            },
            {}
        );

        await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
        console.log('✅ Beautiful buttons sent');
        return true;
    } catch (e) {
        console.log('❌ Buttons failed:', e.message);
        return false;
    }
}

// 💝 Beautiful Full Menu
async function sendBeautifulMenu(sock, jid, db, config, owner, admin, isGroup, prefix) {
    const mode = await db.get('botMode', 'public');
    const modeEmojis = {
        private: '🔒',
        inbox: '📥',
        groups: '👥',
        public: '🌍'
    };

    const menuLines = [
        `╭${'─'.repeat(35)}╮`,
        `┃     💝 *${config.botName}* 💝`,
        `┃     🦄 ✨ ${config.tagline} ✨`,
        `┃     ${modeEmojis[mode]} Mode: ${mode.toUpperCase()}`,
        `╰${'─'.repeat(35)}╮`,
        '',
        `${sectionDivider('📰 NEWS CENTER', '📡')}`,
        `  ✦ ${prefix}news    ─ Fetch Latest News`,
        `  ✦ ${prefix}stats   ─ Bot Statistics`,
        '',
        `${sectionDivider('💾 MEDIA STUDIO', '📦')}`,
        `  ✦ ${prefix}save    ─ Save Media Files`,
        `  ✦ ${prefix}vv      ─ Save View-Once`,
        `  ✦ ${prefix}status  ─ Status Info`,
        '',
        `${sectionDivider('👥 GROUP TOOLS', '👑')}`,
        `  ✦ ${prefix}admins    ─ List Admins`,
        `  ✦ ${prefix}groupinfo ─ Group Details`,
        `  ✦ ${prefix}tagall    ─ Mention All`,
        `  ✦ ${prefix}poll      ─ Create Poll`,
        `  ✦ ${prefix}afk       ─ Set AFK Status`,
        ''
    ];

    if (admin || owner) {
        menuLines.push(
            `${sectionDivider('🛡️ ADMIN PANEL', '⚔️')}`,
            `  ✦ ${prefix}mute/unmute    ─ Toggle Mute`,
            `  ✦ ${prefix}warn @user     ─ Warn Member`,
            `  ✦ ${prefix}kick @user     ─ Remove Member`,
            `  ✦ ${prefix}add 94xxxxxxx  ─ Add Member`,
            `  ✦ ${prefix}promote @user  ─ Make Admin`,
            `  ✦ ${prefix}demote @user   ─ Remove Admin`,
            `  ✦ ${prefix}voice on/off   ─ Toggle Voice`,
            `  ✦ ${prefix}antilink on/off ─ Link Protection`,
            `  ✦ ${prefix}welcome on/off  ─ Welcome Message`,
            `  ✦ ${prefix}goodbye on/off  ─ Goodbye Message`,
            `  ✦ ${prefix}buttons on/off  ─ Button Menu`,
            ''
        );
    }

    if (owner) {
        menuLines.push(
            `${sectionDivider('👑 OWNER SUITE', '💎')}`,
            `  ✦ ${prefix}settings        ─ All Settings`,
            `  ✦ ${prefix}mode public     ─ Bot Mode`,
            `  ✦ ${prefix}autostatus on/off ─ Auto Status`,
            `  ✦ ${prefix}autonews on/off  ─ Auto News`,
            `  ✦ ${prefix}autobio on/off   ─ Auto Bio`,
            `  ✦ ${prefix}setprefix !     ─ Change Prefix`,
            `  ✦ ${prefix}broadcast msg   ─ Mass Message`,
            `  ✦ ${prefix}ban @user       ─ Ban User`,
            `  ✦ ${prefix}unban @user     ─ Unban User`,
            `  ✦ ${prefix}banlist         ─ Banned List`,
            ''
        );
    }

    menuLines.push(
        `${sectionDivider('🎵 VOICE COMMANDS (DM)', '🎤')}`,
        `  gm ✦ gn ✦ hi ✦ ily ✦ bye`,
        `  sad ✦ happy ✦ cry ✦ love`,
        `  ...50+ emotional triggers!`,
        '',
        `${'━'.repeat(35)}`,
        `🦄💝 *\`NewsBot LK\`* 💝🦄`,
        `💝 *\`Charuka Mahesh\`* 💝`,
        '',
        `🌐 ${config.portfolio}`,
        `👨‍💻 ${config.developer}`,
        `📦 Version: ${config.version}`,
        `🔧 Prefix: "${prefix}"`,
        '',
        `💝 *\`Umesha Sathyanjali\`*`,
        `💝 *\`Mithila & Sharada\`*`,
        ''
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

// 💝 Beautiful Settings Panel
async function sendBeautifulSettings(sock, jid, db, isOwner, config) {
    if (!isOwner) {
        await sock.sendMessage(jid, {
            text: `❌ *Owner Only Command!*\n${beautifulFooter()}`
        });
        return;
    }

    const settings = await db.all();
    const bans = await db.banAll();
    const modeEmojis = {
        private: '🔒',
        inbox: '📥',
        groups: '👥',
        public: '🌍'
    };

    const settingsLines = [
        beautifulHeader('⚙️ Bot Settings'),
        '',
        `${sectionDivider('📰 NEWS', '📡')}`,
        `  ▸ Auto News: ${statusBadge(settings.autoNewsEnabled)}`,
        '',
        `${sectionDivider('🖤 STATUS', '📱')}`,
        `  ▸ Auto View: ${statusBadge(settings.autoStatusView)}`,
        `  ▸ Auto React: ${statusBadge(settings.autoStatusReact)}`,
        '',
        `${sectionDivider('🔒 SECURITY', '🛡️')}`,
        `  ▸ Anti-Link: ${statusBadge(settings.antiLinkEnabled)}`,
        `  ▸ Anti VV: ${statusBadge(settings.antiViewOnce)}`,
        '',
        `${sectionDivider('🎵 VOICE', '🎤')}`,
        `  ▸ Voice Replies: ${statusBadge(settings.voiceReplyEnabled)}`,
        '',
        `${sectionDivider('📝 DISPLAY', '✨')}`,
        `  ▸ Auto Bio: ${statusBadge(settings.autoBioEnabled)}`,
        `  ▸ Button Menu: ${statusBadge(settings.buttonMenuEnabled)}`,
        '',
        `${sectionDivider('👥 GROUP', '👑')}`,
        `  ▸ Welcome: ${statusBadge(settings.welcomeEnabled)}`,
        `  ▸ Goodbye: ${statusBadge(settings.goodbyeEnabled)}`,
        '',
        `${sectionDivider('🔧 SYSTEM', '⚙️')}`,
        `  ▸ Prefix: "${settings.prefix || '.'}"`,
        `  ▸ Mode: ${modeEmojis[settings.botMode] || '🌍'} ${(settings.botMode || 'public').toUpperCase()}`,
        `  ▸ Banned Users: ${bans.length}`,
        `  ▸ Version: v${config.version}`,
        '',
        `${'━'.repeat(30)}`,
        `🦄💝 *\`NewsBot LK\`* 💝🦄`,
        ''
    ];

    const caption = settingsLines.join('\n');
    const sent = await sock.sendMessage(jid, {
        image: { url: BOT_LOGO },
        caption: caption,
        mimetype: 'image/png'
    });
    await sock.sendMessage(jid, {
        react: { text: '⚙️', key: sent.key }
    });
}

// 💝 Beautiful Stats
async function sendBeautifulStats(sock, jid, db, config) {
    const settings = await db.all();
    const urlCount = await db.urlsCount();

    const statsLines = [
        beautifulHeader('📊 Statistics'),
        '',
        `${sectionDivider('📊 OVERVIEW', '📈')}`,
        `  📰 News Shared: *${urlCount}*`,
        `  📱 Status Saved: *${fs.readdirSync(STATUS_FOLDER).length}*`,
        `  💾 Media Saved: *${fs.readdirSync(SAVE_FOLDER).length}*`,
        `  🔄 Check Interval: *${CHECK_INTERVAL_MS / 1000}s*`,
        '',
        `${sectionDivider('⚙️ STATUS', '📋')}`,
        `  📰 Auto News: ${statusBadge(settings.autoNewsEnabled)}`,
        `  🖤 Status React: ${statusBadge(settings.autoStatusReact)}`,
        `  🎵 Voice: ${statusBadge(settings.voiceReplyEnabled)}`,
        `  📝 Auto Bio: ${statusBadge(settings.autoBioEnabled)}`,
        '',
        `🔧 Prefix: "${settings.prefix || '.'}"`,
        '',
        beautifulFooter()
    ];

    const caption = statsLines.join('\n');
    const sent = await sock.sendMessage(jid, { text: caption });
    await sock.sendMessage(jid, {
        react: { text: '📊', key: sent.key }
    });
}

// ═══════════════════════════════════════
// 🤖 MAIN BOT ENGINE
// ═══════════════════════════════════════
async function startBot() {
    // Clean up existing connection
    if (sock) {
        try { sock.end(); } catch {}
        sock = null;
    }

    const baileys = await import('@whiskeysockets/baileys');
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason
    } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(
        path.join(__dirname, 'auth_info_baileys')
    );

    sock = makeWASocket({
        auth: state,
        browser: [config.botName, 'Chrome', config.version],
        connectTimeoutMs: 30000,
        printQRInTerminal: false
    });

    // ═══════════════════════════════════════
    // 📨 MESSAGE HANDLER
    // ═══════════════════════════════════════
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;

            const jid = msg.key.remoteJid;

            // Handle status messages
            if (jid === 'status@broadcast') {
                await handleStatus(msg);
                continue;
            }

            // Skip own messages in production
            if (msg.key.fromMe && !TEST_MODE) continue;

            // ═══════════════════════════
            // BUTTON CLICK HANDLER
            // ═══════════════════════════
            const btnResponse = msg.message?.interactiveResponseMessage;
            if (btnResponse) {
                try {
                    const data = JSON.parse(
                        btnResponse.nativeFlowResponseMessage?.paramsJson || '{}'
                    );
                    const btnId = data.id;
                    console.log(`🔘 Button clicked: ${btnId} from ${jid}`);

                    const sender = msg.key.participant || jid;
                    const senderNum = sender.split('@')[0].replace(/[^0-9]/g, '');
                    const isUserOwner = isOwner(senderNum, sender);
                    const isGroup = jid.endsWith('@g.us');
                    const isAdmin = isGroup ? await checkAdmin(jid, sender) : false;
                    const prefix = await db.get('prefix', '.');

                    const buttonActions = {
                        'btn_news': async () => {
                            await sock.sendMessage(jid, {
                                text: '📰 *Fetching latest news...*\n⏳ Please wait...'
                            });
                            await checkAndShareAllNewNews();
                        },
                        'btn_menu': async () => {
                            await sendBeautifulMenu(
                                sock, jid, db, config,
                                isUserOwner, isAdmin, isGroup, prefix
                            );
                        },
                        'btn_settings': async () => {
                            await sendBeautifulSettings(
                                sock, jid, db, isUserOwner, config
                            );
                        },
                        'btn_save': async () => {
                            await sock.sendMessage(jid, {
                                text: [
                                    '💡 *How to Save Media*',
                                    '',
                                    'Reply to any media message with:',
                                    `📌 *${prefix}save*`,
                                    '',
                                    beautifulFooter()
                                ].join('\n')
                            });
                        },
                        'btn_vv': async () => {
                            await sock.sendMessage(jid, {
                                text: [
                                    '💡 *How to Save View-Once*',
                                    '',
                                    'Reply to a view-once message with:',
                                    `📌 *${prefix}vv*`,
                                    '',
                                    beautifulFooter()
                                ].join('\n')
                            });
                        },
                        'btn_voice_on': async () => {
                            await db.set('voiceReplyEnabled', true);
                            await sock.sendMessage(jid, {
                                text: `🎵 *Voice Replies: ${statusBadge(true)}*\n${beautifulFooter()}`
                            });
                        },
                        'btn_voice_off': async () => {
                            await db.set('voiceReplyEnabled', false);
                            await sock.sendMessage(jid, {
                                text: `🎵 *Voice Replies: ${statusBadge(false)}*\n${beautifulFooter()}`
                            });
                        },
                        'btn_antilink_on': async () => {
                            await db.set('antiLinkEnabled', true);
                            await sock.sendMessage(jid, {
                                text: `🔗 *Anti-Link: ${statusBadge(true)}*\n${beautifulFooter()}`
                            });
                        },
                        'btn_mute': async () => {
                            if (isGroup) {
                                await db.groupSet(jid, 'isMuted', true);
                                await sock.sendMessage(jid, {
                                    text: `🔇 *Group Muted for 30 Minutes*\n${beautifulFooter()}`
                                });
                                setTimeout(() => {
                                    db.groupSet(jid, 'isMuted', false);
                                }, 30 * 60 * 1000);
                            }
                        },
                        'btn_autostatus_on': async () => {
                            await db.set('autoStatusView', true);
                            await db.set('autoStatusReact', true);
                            await sock.sendMessage(jid, {
                                text: `🖤 *Auto Status: ${statusBadge(true)}*\n${beautifulFooter()}`
                            });
                        },
                        'btn_autobio_on': async () => {
                            await db.set('autoBioEnabled', true);
                            await sock.sendMessage(jid, {
                                text: `📝 *Auto Bio: ${statusBadge(true)}*\n${beautifulFooter()}`
                            });
                            await updateBotBio();
                        },
                        'btn_mode_public': async () => {
                            await db.set('botMode', 'public');
                            await sock.sendMessage(jid, {
                                text: `🌍 *Mode Changed to: PUBLIC*\n${beautifulFooter()}`
                            });
                        }
                    };

                    if (buttonActions[btnId]) {
                        await buttonActions[btnId]();
                    }
                } catch (e) {
                    console.log('❌ Button handler error:', e.message);
                }
                return;
            }

            // ═══════════════════════════
            // TEXT MESSAGE HANDLER
            // ═══════════════════════════
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
                console.log(`📩 Command from [${senderNum}]: "${lower}"`);
            }

            // Check bot mode access
            if (!await canUseBot(jid, isUserOwner)) {
                if (lower.startsWith(prefix) || lower.startsWith('.')) {
                    const mode = await db.get('botMode', 'public');
                    await sock.sendMessage(jid, {
                        text: `🔒 *Bot is in ${mode.toUpperCase()} Mode!*\n${beautifulFooter()}`
                    });
                }
                return;
            }

            // Check ban
            if (await db.banCheck(sender) && !isUserOwner) return;

            // ═══════════════════════════
            // MENU COMMANDS
            // ═══════════════════════════
            if (lower === '.menu' || lower === `${prefix}menu` || lower === 'menu') {
                const btnEnabled = await db.get('buttonMenuEnabled', true);
                if (btnEnabled) {
                    const sent = await sendNativeButtons(
                        sock, jid, db, config,
                        isUserOwner, isAdmin, prefix
                    );
                    if (!sent) {
                        await sendBeautifulMenu(
                            sock, jid, db, config,
                            isUserOwner, isAdmin, isGroup, prefix
                        );
                    }
                } else {
                    await sendBeautifulMenu(
                        sock, jid, db, config,
                        isUserOwner, isAdmin, isGroup, prefix
                    );
                }
                return;
            }

            // ═══════════════════════════
            // SETTINGS
            // ═══════════════════════════
            if (lower === '.settings' || lower === `${prefix}settings` || lower === 'settings') {
                await sendBeautifulSettings(sock, jid, db, isUserOwner, config);
                return;
            }

            // ═══════════════════════════
            // BUTTON TOGGLE
            // ═══════════════════════════
            if (lower === '.buttons on' || lower === `${prefix}buttons on`) {
                if (canToggle) {
                    await db.set('buttonMenuEnabled', true);
                    await sock.sendMessage(jid, {
                        text: `🔘 *Button Menu: ${statusBadge(true)}*\n${beautifulFooter()}`
                    });
                }
                return;
            }

            if (lower === '.buttons off' || lower === `${prefix}buttons off`) {
                if (canToggle) {
                    await db.set('buttonMenuEnabled', false);
                    await sock.sendMessage(jid, {
                        text: `📋 *Text Menu: ${statusBadge(true)}*\n${beautifulFooter()}`
                    });
                }
                return;
            }

            // ═══════════════════════════
            // VOICE TOGGLE
            // ═══════════════════════════
            if (lower === '.voice on' || lower === `${prefix}voice on`) {
                if (canToggle) {
                    await db.set('voiceReplyEnabled', true);
                    await sock.sendMessage(jid, {
                        text: `🎵 *Voice Replies: ${statusBadge(true)}*\n${beautifulFooter()}`
                    });
                }
                return;
            }

            if (lower === '.voice off' || lower === `${prefix}voice off`) {
                if (canToggle) {
                    await db.set('voiceReplyEnabled', false);
                    await sock.sendMessage(jid, {
                        text: `🎵 *Voice Replies: ${statusBadge(false)}*\n${beautifulFooter()}`
                    });
                }
                return;
            }

            // ═══════════════════════════
            // TOGGLE SWITCHES (Admin)
            // ═══════════════════════════
            if (canToggle) {
                const toggleCommands = {
                    '.antilink on': {
                        key: 'antiLinkEnabled',
                        message: '🔗 *Anti-Link: ON ✅*'
                    },
                    '.antilink off': {
                        key: 'antiLinkEnabled',
                        value: false,
                        message: '🔗 *Anti-Link: OFF ❌*'
                    },
                    '.antiview on': {
                        key: 'antiViewOnce',
                        message: '🚫 *Anti View-Once: ON ✅*'
                    },
                    '.antiview off': {
                        key: 'antiViewOnce',
                        value: false,
                        message: '👁️ *Anti View-Once: OFF ❌*'
                    },
                    '.welcome on': {
                        key: 'welcomeEnabled',
                        message: '👋 *Welcome Messages: ON ✅*'
                    },
                    '.welcome off': {
                        key: 'welcomeEnabled',
                        value: false,
                        message: '👋 *Welcome Messages: OFF ❌*'
                    },
                    '.goodbye on': {
                        key: 'goodbyeEnabled',
                        message: '👋 *Goodbye Messages: ON ✅*'
                    },
                    '.goodbye off': {
                        key: 'goodbyeEnabled',
                        value: false,
                        message: '👋 *Goodbye Messages: OFF ❌*'
                    },
                    '.autobio on': {
                        key: 'autoBioEnabled',
                        message: '📝 *Auto Bio: ON ✅*'
                    },
                    '.autobio off': {
                        key: 'autoBioEnabled',
                        value: false,
                        message: '📝 *Auto Bio: OFF ❌*'
                    }
                };

                for (const [cmd, config] of Object.entries(toggleCommands)) {
                    const cmdWithPrefix = `${prefix}${cmd.replace('.', '')}`;
                    if (lower === cmd || lower === cmdWithPrefix) {
                        await db.set(
                            config.key,
                            config.value !== undefined ? config.value : true
                        );
                        await sock.sendMessage(jid, {
                            text: `${config.message}\n${beautifulFooter()}`
                        });
                        return;
                    }
                }
            }

            // ═══════════════════════════
            // VOICE REPLIES
            // ═══════════════════════════
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

            // ═══════════════════════════
            // VIEW-ONCE SAVER
            // ═══════════════════════════
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
                        const caption = [
                            `📱 *View-Once Saved!*`,
                            `👤 @${sender.split('@')[0]}`,
                            '',
                            beautifulFooter()
                        ].join('\n');

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
                        } catch (e) {
                            // Silent fail
                        }
                    }

                    await sock.sendMessage(jid, {
                        text: saved
                            ? `✅ *View-Once Saved!* 📥\n${beautifulFooter()}`
                            : `❌ *Failed to Save!*\n${beautifulFooter()}`
                    });
                } else {
                    await sock.sendMessage(jid, {
                        text: [
                            '💡 *How to Use View-Once Saver*',
                            '',
                            '📌 Reply to a view-once message with:',
                            `   *${prefix}vv*`,
                            '',
                            beautifulFooter()
                        ].join('\n')
                    });
                }
                return;
            }

            // ═══════════════════════════
            // MODE COMMAND (Owner)
            // ═══════════════════════════
            if (isUserOwner && (lower === '.mode' || lower.startsWith('.mode ') || lower === `${prefix}mode`)) {
                const modeArg = text
                    .replace('.mode', '')
                    .replace(`${prefix}mode`, '')
                    .trim()
                    .toLowerCase();

                const validModes = ['private', 'inbox', 'groups', 'public'];
                const modeEmojis = {
                    private: '🔒',
                    inbox: '📥',
                    groups: '👥',
                    public: '🌍'
                };

                if (validModes.includes(modeArg)) {
                    await db.set('botMode', modeArg);
                    await sock.sendMessage(jid, {
                        text: [
                            `${modeEmojis[modeArg]} *Mode Changed!*`,
                            `📌 New Mode: *${modeArg.toUpperCase()}*`,
                            '',
                            beautifulFooter()
                        ].join('\n')
                    });
                } else {
                    const currentMode = await db.get('botMode', 'public');
                    await sock.sendMessage(jid, {
                        text: [
                            `${modeEmojis[currentMode]} *Current Mode: ${currentMode.toUpperCase()}*`,
                            '',
                            '💡 Usage: .mode [private|inbox|groups|public]',
                            '',
                            '🔒 Private  ─ Bot disabled',
                            '📥 Inbox    ─ DMs only',
                            '👥 Groups   ─ Groups only',
                            '🌍 Public   ─ All chats',
                            '',
                            beautifulFooter()
                        ].join('\n')
                    });
                }
                return;
            }

            // ═══════════════════════════
            // OWNER COMMANDS
            // ═══════════════════════════
            if (isUserOwner) {
                // Auto Status
                if (lower === '.autostatus on' || lower === `${prefix}autostatus on`) {
                    await db.set('autoStatusView', true);
                    await db.set('autoStatusReact', true);
                    await sock.sendMessage(jid, {
                        text: `🖤 *Auto Status: ${statusBadge(true)}*\n${beautifulFooter()}`
                    });
                    return;
                }
                if (lower === '.autostatus off' || lower === `${prefix}autostatus off`) {
                    await db.set('autoStatusView', false);
                    await db.set('autoStatusReact', false);
                    await sock.sendMessage(jid, {
                        text: `🖤 *Auto Status: ${statusBadge(false)}*\n${beautifulFooter()}`
                    });
                    return;
                }

                // Auto News
                if (lower === '.autonews on' || lower === `${prefix}autonews on`) {
                    await db.set('autoNewsEnabled', true);
                    await sock.sendMessage(jid, {
                        text: `📰 *Auto News: ${statusBadge(true)}*\n${beautifulFooter()}`
                    });
                    return;
                }
                if (lower === '.autonews off' || lower === `${prefix}autonews off`) {
                    await db.set('autoNewsEnabled', false);
                    await sock.sendMessage(jid, {
                        text: `📰 *Auto News: ${statusBadge(false)}*\n${beautifulFooter()}`
                    });
                    return;
                }

                // Set Prefix
                if (lower.startsWith('.setprefix ') || lower.startsWith(`${prefix}setprefix `)) {
                    const newPrefix = text
                        .replace('.setprefix', '')
                        .replace(`${prefix}setprefix`, '')
                        .trim();

                    if (newPrefix.length >= 1 && newPrefix.length <= 3) {
                        await db.set('prefix', newPrefix);
                        await sock.sendMessage(jid, {
                            text: [
                                `🔧 *Prefix Updated!*`,
                                `📌 New Prefix: *"${newPrefix}"*`,
                                `💡 Use *${newPrefix}menu* to test`,
                                '',
                                beautifulFooter()
                            ].join('\n')
                        });
                    } else {
                        await sock.sendMessage(jid, {
                            text: `❌ *Invalid prefix!* Use 1-3 characters.\n${beautifulFooter()}`
                        });
                    }
                    return;
                }

                // Broadcast
                if (lower.startsWith('.broadcast ') || lower.startsWith(`${prefix}broadcast `)) {
                    const broadcastMsg = text
                        .replace('.broadcast', '')
                        .replace(`${prefix}broadcast`, '')
                        .trim();

                    try {
                        const groups = await sock.groupFetchAllParticipating();
                        let count = 0;

                        for (const groupId of Object.keys(groups)) {
                            try {
                                await sock.sendMessage(groupId, {
                                    text: [
                                        `📢 *Broadcast Message*`,
                                        '',
                                        broadcastMsg,
                                        '',
                                        beautifulFooter()
                                    ].join('\n')
                                });
                                count++;
                                await new Promise(r => setTimeout(r, 1000));
                            } catch {
                                // Skip failed groups
                            }
                        }

                        await sock.sendMessage(jid, {
                            text: `📢 *Broadcast Sent!*\n✅ Delivered to *${count}* groups\n${beautifulFooter()}`
                        });
                    } catch (e) {
                        await sock.sendMessage(jid, {
                            text: `❌ *Broadcast Failed!*\n${beautifulFooter()}`
                        });
                    }
                    return;
                }

                // Ban
                if (lower.startsWith('.ban ') || lower.startsWith(`${prefix}ban `)) {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (mentioned?.length) {
                        await db.banAdd(mentioned[0]);
                        await sock.sendMessage(jid, {
                            text: `🚫 *User Banned!*\n👤 @${mentioned[0].split('@')[0]}\n${beautifulFooter()}`,
                            mentions: [mentioned[0]]
                        });
                    }
                    return;
                }

                // Unban
                if (lower.startsWith('.unban ') || lower.startsWith(`${prefix}unban `)) {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (mentioned?.length) {
                        await db.banRemove(mentioned[0]);
                        await sock.sendMessage(jid, {
                            text: `✅ *User Unbanned!*\n👤 @${mentioned[0].split('@')[0]}\n${beautifulFooter()}`,
                            mentions: [mentioned[0]]
                        });
                    }
                    return;
                }

                // Ban List
                if (lower === '.banlist' || lower === `${prefix}banlist`) {
                    const bans = await db.banAll();
                    if (!bans.length) {
                        await sock.sendMessage(jid, {
                            text: `✅ *No Banned Users!*\n${beautifulFooter()}`
                        });
                    } else {
                        const banList = bans.map((ban, index) =>
                            `${index + 1}. @${ban.userId.split('@')[0]}`
                        ).join('\n');

                        await sock.sendMessage(jid, {
                            text: [
                                `🚫 *Banned Users (${bans.length})*`,
                                '',
                                banList,
                                '',
                                beautifulFooter()
                            ].join('\n'),
                            mentions: bans.map(b => b.userId)
                        });
                    }
                    return;
                }

                // Clear Warnings
                if (lower.startsWith('.clearwarns ') || lower.startsWith(`${prefix}clearwarns `)) {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (mentioned?.length) {
                        await db.warnClear(mentioned[0], jid);
                        await sock.sendMessage(jid, {
                            text: `✅ *Warnings Cleared!*\n👤 @${mentioned[0].split('@')[0]}\n${beautifulFooter()}`,
                            mentions: [mentioned[0]]
                        });
                    }
                    return;
                }
            }

            // ═══════════════════════════
            // GROUP COMMANDS
            // ═══════════════════════════
            if (isGroup) {
                // List Admins
                if (lower === '.admins' || lower === `${prefix}admins`) {
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const admins = metadata.participants.filter(p => p.admin);
                        const adminList = admins.map(p =>
                            `👑 @${p.id.split('@')[0]}`
                        ).join('\n');

                        const sent = await sock.sendMessage(jid, {
                            text: [
                                `👑 *Group Admins*`,
                                '',
                                adminList,
                                '',
                                beautifulFooter()
                            ].join('\n'),
                            mentions: admins.map(p => p.id)
                        });
                        await sock.sendMessage(jid, {
                            react: { text: '👑', key: sent.key }
                        });
                    } catch (e) {
                        // Silent fail
                    }
                    return;
                }

                // Group Info
                if (lower === '.groupinfo' || lower === `${prefix}groupinfo` || lower === '.gcinfo') {
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const sent = await sock.sendMessage(jid, {
                            text: [
                                `📋 *Group Information*`,
                                '',
                                `📌 *Name:* ${metadata.subject}`,
                                `👥 *Members:* ${metadata.participants.length}`,
                                `👑 *Owner:* @${metadata.owner?.split('@')[0]}`,
                                `📅 *Created:* ${new Date(metadata.creation * 1000).toLocaleDateString()}`,
                                '',
                                beautifulFooter()
                            ].join('\n'),
                            mentions: [metadata.owner]
                        });
                        await sock.sendMessage(jid, {
                            react: { text: '📋', key: sent.key }
                        });
                    } catch (e) {
                        // Silent fail
                    }
                    return;
                }

                // Tag All
                if (lower === '.tagall' || lower === `${prefix}tagall` || lower === '.everyone') {
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const sent = await sock.sendMessage(jid, {
                            text: [
                                `📢 *Attention Everyone!*`,
                                '',
                                beautifulFooter()
                            ].join('\n'),
                            mentions: metadata.participants.map(p => p.id)
                        });
                        await sock.sendMessage(jid, {
                            react: { text: '📢', key: sent.key }
                        });
                    } catch (e) {
                        // Silent fail
                    }
                    return;
                }

                // Poll
                if (lower.startsWith('.poll ') || lower.startsWith(`${prefix}poll `)) {
                    const pollQuestion = text
                        .replace('.poll', '')
                        .replace(`${prefix}poll`, '')
                        .trim();

                    const sent = await sock.sendMessage(jid, {
                        poll: {
                            name: `📊 ${pollQuestion}`,
                            values: ['👍 Yes', '👎 No', '🤔 Maybe'],
                            selectableCount: 1
                        }
                    });
                    await sock.sendMessage(jid, {
                        react: { text: '📊', key: sent.key }
                    });
                    return;
                }

                // AFK
                if (lower.startsWith('.afk') || lower.startsWith(`${prefix}afk`)) {
                    const reason = text
                        .replace('.afk', '')
                        .replace(`${prefix}afk`, '')
                        .trim() || 'No reason';

                    await db.afkSet(sender, reason);
                    const sent = await sock.sendMessage(jid, {
                        text: [
                            `💤 *AFK Mode Activated*`,
                            `👤 @${sender.split('@')[0]}`,
                            `📝 ${reason}`,
                            '',
                            beautifulFooter()
                        ].join('\n'),
                        mentions: [sender]
                    });
                    await sock.sendMessage(jid, {
                        react: { text: '💤', key: sent.key }
                    });
                    return;
                }

                // ═══════════════════════════
                // ADMIN COMMANDS
                // ═══════════════════════════
                if (isAdmin || isUserOwner) {
                    // Mute
                    if (lower === '.mute' || lower === `${prefix}mute`) {
                        await db.groupSet(jid, 'isMuted', true);
                        await sock.sendMessage(jid, {
                            text: `🔇 *Group Muted for 30 Minutes*\n${beautifulFooter()}`
                        });
                        setTimeout(() => {
                            db.groupSet(jid, 'isMuted', false);
                        }, 30 * 60 * 1000);
                        return;
                    }

                    // Unmute
                    if (lower === '.unmute' || lower === `${prefix}unmute`) {
                        await db.groupSet(jid, 'isMuted', false);
                        await sock.sendMessage(jid, {
                            text: `🔊 *Group Unmuted!*\n${beautifulFooter()}`
                        });
                        return;
                    }

                    // Warn
                    if (lower.startsWith('.warn ') || lower.startsWith(`${prefix}warn `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            const count = await db.warnAdd(mentioned[0], jid);
                            await sock.sendMessage(jid, {
                                text: `⚠️ *Warning ${count}/3*\n👤 @${mentioned[0].split('@')[0]}\n${beautifulFooter()}`,
                                mentions: [mentioned[0]]
                            });

                            // Auto kick at 3 warnings
                            if (count >= 3) {
                                try {
                                    await sock.groupParticipantsUpdate(
                                        jid,
                                        [mentioned[0]],
                                        'remove'
                                    );
                                    await db.warnClear(mentioned[0], jid);
                                    await sock.sendMessage(jid, {
                                        text: `🚫 *User Kicked!*\n👤 @${mentioned[0].split('@')[0]}\n⚠️ Reached 3 warnings\n${beautifulFooter()}`,
                                        mentions: [mentioned[0]]
                                    });
                                } catch (e) {
                                    // Silent fail
                                }
                            }
                        }
                        return;
                    }

                    // Kick
                    if (lower.startsWith('.kick ') || lower.startsWith(`${prefix}kick `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            try {
                                await sock.groupParticipantsUpdate(
                                    jid,
                                    [mentioned[0]],
                                    'remove'
                                );
                                await sock.sendMessage(jid, {
                                    text: `🚫 *User Removed!*\n👤 @${mentioned[0].split('@')[0]}\n${beautifulFooter()}`,
                                    mentions: [mentioned[0]]
                                });
                            } catch (e) {
                                await sock.sendMessage(jid, {
                                    text: `❌ *Failed to Remove User!*\n${beautifulFooter()}`
                                });
                            }
                        }
                        return;
                    }

                    // Add
                    if (lower.startsWith('.add ') || lower.startsWith(`${prefix}add `)) {
                        const number = text
                            .replace('.add', '')
                            .replace(`${prefix}add`, '')
                            .trim()
                            .replace(/[^0-9]/g, '');

                        if (number) {
                            try {
                                await sock.groupParticipantsUpdate(
                                    jid,
                                    [`${number}@s.whatsapp.net`],
                                    'add'
                                );
                                await sock.sendMessage(jid, {
                                    text: `✅ *User Added!*\n👤 ${number}\n${beautifulFooter()}`
                                });
                            } catch (e) {
                                await sock.sendMessage(jid, {
                                    text: `❌ *Failed to Add User!*\n${beautifulFooter()}`
                                });
                            }
                        }
                        return;
                    }

                    // Promote
                    if (lower.startsWith('.promote ') || lower.startsWith(`${prefix}promote `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            try {
                                await sock.groupParticipantsUpdate(
                                    jid,
                                    [mentioned[0]],
                                    'promote'
                                );
                                await sock.sendMessage(jid, {
                                    text: `👑 *Promoted to Admin!*\n👤 @${mentioned[0].split('@')[0]}\n${beautifulFooter()}`,
                                    mentions: [mentioned[0]]
                                });
                            } catch (e) {
                                await sock.sendMessage(jid, {
                                    text: `❌ *Failed to Promote!*\n${beautifulFooter()}`
                                });
                            }
                        }
                        return;
                    }

                    // Demote
                    if (lower.startsWith('.demote ') || lower.startsWith(`${prefix}demote `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            try {
                                await sock.groupParticipantsUpdate(
                                    jid,
                                    [mentioned[0]],
                                    'demote'
                                );
                                await sock.sendMessage(jid, {
                                    text: `⬇️ *Admin Demoted!*\n👤 @${mentioned[0].split('@')[0]}\n${beautifulFooter()}`,
                                    mentions: [mentioned[0]]
                                });
                            } catch (e) {
                                await sock.sendMessage(jid, {
                                    text: `❌ *Failed to Demote!*\n${beautifulFooter()}`
                                });
                            }
                        }
                        return;
                    }
                }
            }

            // ═══════════════════════════
            // NEWS COMMAND
            // ═══════════════════════════
            if (lower === '.news' || lower === `${prefix}news` || lower === 'news') {
                if (!await db.get('autoNewsEnabled', true) && !isUserOwner) {
                    await sock.sendMessage(jid, {
                        text: `❌ *News Feature Disabled!*\n${beautifulFooter()}`
                    });
                    return;
                }

                await sock.sendMessage(jid, {
                    text: `📰 *Fetching Latest News...*\n⏳ Please wait...\n${beautifulFooter()}`
                });
                await checkAndShareAllNewNews();
                return;
            }

            // ═══════════════════════════
            // STATS COMMAND
            // ═══════════════════════════
            if (lower === '.stats' || lower === `${prefix}stats` || lower === 'stats') {
                await sendBeautifulStats(sock, jid, db, config);
                return;
            }

            // ═══════════════════════════
            // STATUS INFO
            // ═══════════════════════════
            if (lower === '.status' || lower === `${prefix}status` || lower === '.vs') {
                const settings = await db.all();
                const statusText = [
                    `📱 *Status Saver Information*`,
                    '',
                    `👁️ Auto View: ${statusBadge(settings.autoStatusView)}`,
                    `💬 Auto React: ${statusBadge(settings.autoStatusReact)}`,
                    `📵 Forward: DISABLED`,
                    `📂 Statuses Saved: *${fs.readdirSync(STATUS_FOLDER).length}*`,
                    '',
                    beautifulFooter()
                ].join('\n');

                const sent = await sock.sendMessage(jid, { text: statusText });
                await sock.sendMessage(jid, {
                    react: { text: '📱', key: sent.key }
                });
                return;
            }

            // ═══════════════════════════
            // SAVE MEDIA COMMAND
            // ═══════════════════════════
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
                                caption: `💾 *Media Saved!*\n${beautifulFooter()}`
                            });
                        } else if (saved.type === 'videoMessage') {
                            await sock.sendMessage(jid, {
                                video: saved.buffer,
                                caption: `💾 *Media Saved!*\n${beautifulFooter()}`
                            });
                        } else if (saved.type === 'stickerMessage') {
                            await sock.sendMessage(jid, {
                                sticker: saved.buffer
                            });
                        } else {
                            await sock.sendMessage(jid, {
                                document: saved.buffer,
                                fileName: saved.filename,
                                caption: `💾 *Media Saved!*\n${beautifulFooter()}`
                            });
                        }
                    } else {
                        await sock.sendMessage(jid, {
                            text: `❌ *Failed to Save Media!*\n${beautifulFooter()}`
                        });
                    }
                } else {
                    await sock.sendMessage(jid, {
                        text: [
                            '💡 *How to Save Media*',
                            '',
                            '📌 Reply to any media message with:',
                            `   *${prefix}save*`,
                            '',
                            '🖼️ Images | 🎥 Videos | 🎵 Audio | 🎨 Stickers',
                            '',
                            beautifulFooter()
                        ].join('\n')
                    });
                }
                return;
            }

            // ═══════════════════════════
            // ANTI-LINK DETECTION
            // ═══════════════════════════
            if (
                isGroup &&
                await db.get('antiLinkEnabled', false) &&
                /https?:\/\/(?:chat\.whatsapp\.com|t\.me|discord\.gg)/i.test(text) &&
                !isAdmin &&
                !isUserOwner
            ) {
                try {
                    await sock.sendMessage(jid, { delete: msg.key });
                } catch (e) {
                    // Silent fail
                }
                await sock.sendMessage(jid, {
                    text: `🔗 *Link Detected & Deleted!*\n👤 @${sender.split('@')[0]}\n⚠️ Sharing links is not allowed!\n${beautifulFooter()}`,
                    mentions: [sender]
                });
                return;
            }

            // ═══════════════════════════
            // AFK DETECTION
            // ═══════════════════════════
            if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                for (const mentioned of msg.message.extendedTextMessage.contextInfo.mentionedJid) {
                    const afkData = await db.afkGet(mentioned);
                    if (afkData) {
                        const minutes = Math.floor(
                            (Date.now() - new Date(afkData.afkAt).getTime()) / 60000
                        );
                        await sock.sendMessage(jid, {
                            text: [
                                `💤 *User is AFK*`,
                                `👤 @${mentioned.split('@')[0]}`,
                                `📝 ${afkData.reason}`,
                                `⏰ ${minutes} minutes ago`,
                                '',
                                beautifulFooter()
                            ].join('\n'),
                            mentions: [mentioned]
                        });
                    }
                }
            }

            // Auto-remove AFK when user sends a message
            if (
                await db.afkGet(sender) &&
                !lower.startsWith('.afk') &&
                !lower.startsWith(`${prefix}afk`)
            ) {
                await db.afkRemove(sender);
            }
        }
    });

    // ═══════════════════════════════════════
    // 👥 GROUP PARTICIPANT UPDATES
    // ═══════════════════════════════════════
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        // Welcome Message
        if (action === 'add' && await db.get('welcomeEnabled', false)) {
            const welcomeMsg = await db.get(
                'welcomeMessage',
                '👋 Welcome to the group @user! 🎉'
            );

            for (const participant of participants) {
                await sock.sendMessage(id, {
                    text: [
                        `🎉 *Welcome!*`,
                        '',
                        welcomeMsg.replace('@user', `@${participant.split('@')[0]}`),
                        '',
                        beautifulFooter()
                    ].join('\n'),
                    mentions: [participant]
                });
            }
        }

        // Goodbye Message
        if (action === 'remove' && await db.get('goodbyeEnabled', false)) {
            const goodbyeMsg = await db.get(
                'goodbyeMessage',
                '👋 @user has left the group! 😢'
            );

            for (const participant of participants) {
                await sock.sendMessage(id, {
                    text: [
                        `😢 *Goodbye!*`,
                        '',
                        goodbyeMsg.replace('@user', `@${participant.split('@')[0]}`),
                        '',
                        beautifulFooter()
                    ].join('\n'),
                    mentions: [participant]
                });
            }
        }
    });

    // ═══════════════════════════════════════
    // 🔌 CONNECTION UPDATES
    // ═══════════════════════════════════════
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        // Show QR code
        if (qr) {
            console.log('\n📱 Scan QR Code to Connect:\n');
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

                const delay = Math.min(30000, 5000 * reconnectAttempts);
                reconnectTimer = setTimeout(async () => {
                    reconnectTimer = null;
                    await startBot();
                }, delay);
            } else {
                console.log('\n❌ Logged out! Please re-authenticate.\n');
            }
        }

        // Connection opened
        else if (connection === 'open') {
            isConnected = true;
            reconnectAttempts = 0;

            if (sock.user) {
                ownerJid = sock.user.id.replace(/:.*/, '') + '@s.whatsapp.net';
            }

            console.log('\n' + '═'.repeat(50));
            console.log('  💝 NewsBot LK - Connected Successfully! 💝');
            console.log('═'.repeat(50));
            console.log(`  👑 Owner: ${ownerJid}`);
            console.log(`  🗄️ Database: ${useJsonFallback ? 'JSON File' : 'MongoDB'}`);
            console.log(`  🦄 Version: ${config.version}`);
            console.log('═'.repeat(50) + '\n');

            // Send beautiful connected message to owner
            if (ownerJid) {
                try {
                    await sock.sendMessage(ownerJid, {
                        image: { url: BOT_LOGO },
                        caption: [
                            beautifulHeader(config.botName),
                            '',
                            `✨ *Bot Successfully Connected!* ✨`,
                            '',
                            `${EMOJIS.check} *Status: Online*`,
                            `${EMOJIS.heart} *Status React: ${statusBadge(await db.get('autoStatusReact', true))}*`,
                            `${EMOJIS.menu} *.menu: Show Menu*`,
                            `${EMOJIS.settings} *.settings: Settings*`,
                            '',
                            `🔘 *Button Menu: ${statusBadge(await db.get('buttonMenuEnabled', true))}*`,
                            '',
                            '━'.repeat(30),
                            '',
                            `🦄💝 *\`NewsBot LK\`* 💝🦄`,
                            `💝 *\`Charuka Mahesh\`* 💝`,
                            '',
                            `💝 *\`Dedicated to:\`*`,
                            `🌸 Umesha Sathyanjali`,
                            `🌸 Mithila`,
                            `🌸 Sharada`,
                            ''
                        ].join('\n'),
                        mimetype: 'image/png'
                    });
                } catch (e) {
                    console.error('❌ Failed to send connected message');
                }
            }

            // Initial news fetch
            if (await db.get('autoNewsEnabled', true)) {
                await checkAndShareAllNewNews();
            }

            // Update bio after delay
            setTimeout(async () => {
                await updateBotBio();
            }, 5000);
        }
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);
}

// ═══════════════════════════════════════
// 📰 NEWS SCRAPER
// ═══════════════════════════════════════

// Scrape article details
async function scrapeArticle(url) {
    try {
        const { data: html } = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
            }
        });

        if (!html) {
            return { description: '', image: '' };
        }

        // Extract OG image
        let image = '';
        const ogMatch = html.match(
            /<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i
        );
        if (ogMatch?.[1]) {
            image = ogMatch[1];
        }

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
    } catch {
        return { description: '', image: '' };
    }
}

// Fetch Hiru News
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
        } catch (e) {
            // Skip failed categories
        }
    }

    return newsItems;
}

// Fetch Derana News
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
                        desc = String(desc)
                            .replace(/<[^>]*>/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
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

                    // Rate limit
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }
    } catch (e) {
        // Silent fail
    }

    return newsItems;
}

// Fetch RSS Feed
async function fetchRSS(url, source, limit = 3) {
    const newsItems = [];

    try {
        const { data } = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
            }
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

                // Rate limit
                await new Promise(r => setTimeout(r, 500));
            }
        }
    } catch (e) {
        // Silent fail
    }

    return newsItems;
}

// Fetch All Latest News
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
                        const description = cleanText(result.result.desc || '');
                        if (description.length > 50) {
                            return [{
                                source: '📰 Ada.lk',
                                category: 'Latest',
                                title: result.result.title,
                                description: description,
                                url: result.result.url,
                                image: result.result.image || FALLBACK_IMAGE,
                                date: `${result.result.date} ${result.result.time}`
                            }];
                        }
                    }
                } catch (e) {
                    // Silent fail
                }
                return [];
            }
        },
        {
            name: 'Newswire',
            fetch: async () => {
                try {
                    const result = await dynews.newswire();
                    if (result?.status && result.result?.url) {
                        const description = cleanText(result.result.desc || '');
                        if (description.length > 50) {
                            return [{
                                source: '📰 Newswire',
                                category: 'Latest',
                                title: result.result.title,
                                description: description,
                                url: result.result.url,
                                image: result.result.image || FALLBACK_IMAGE,
                                date: `${result.result.date} ${result.result.time}`
                            }];
                        }
                    }
                } catch (e) {
                    // Silent fail
                }
                return [];
            }
        },
        {
            name: 'Sirasa',
            fetch: async () => {
                try {
                    const result = await dynews.sirasa();
                    if (result?.status && result.result?.url) {
                        const description = cleanText(result.result.desc || '');
                        if (description.length > 50) {
                            return [{
                                source: '📺 Sirasa',
                                category: 'Latest',
                                title: result.result.title,
                                description: description,
                                url: result.result.url,
                                image: result.result.image || FALLBACK_IMAGE,
                                date: `${result.result.date} ${result.result.time}`
                            }];
                        }
                    }
                } catch (e) {
                    // Silent fail
                }
                return [];
            }
        }
    ];

    // Fetch all sources in parallel
    const results = await Promise.allSettled(
        sources.map(source => source.fetch())
    );

    // Collect all news items
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

// Send News Article
async function sendNews(jid, article) {
    if (!sock?.user) return false;

    const description = truncate(
        (article.description || article.title || '').trim(),
        5000
    );

    const caption = [
        `📰 *${article.source}* | ${article.category}`,
        '',
        `📌 *${article.title}*`,
        '',
        description,
        '',
        article.date ? `📅 ${article.date}` : '',
        `🔗 ${article.url}`,
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
            } catch (e) {
                // Image failed, fall back to bot logo
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
                text: randomEmoji(REACTIONS),
                key: sent.key
            }
        });

        return true;
    } catch {
        return false;
    }
}

// Check and Share New News
async function checkAndShareAllNewNews() {
    if (!sock?.user) return;

    // Check if group is muted
    if (await db.groupGet(NEWS_GROUP_JID, 'isMuted', false)) {
        console.log('🔇 News group is muted, skipping...');
        return;
    }

    try {
        const allNews = await fetchAllLatestNews();
        if (!allNews.length) {
            console.log('📰 No news articles found');
            return;
        }

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
    } catch (e) {
        console.error('❌ News check failed:', e.message);
    }
}

// ═══════════════════════════════════════
// 🚀 STARTUP
// ═══════════════════════════════════════
(async () => {
    // Beautiful startup banner
    console.log('\n' + '═'.repeat(50));
    console.log('  💝 NewsBot LK - Starting Up 💝');
    console.log('═'.repeat(50));
    console.log(`  📦 Version: ${config.version}`);
    console.log(`  👨‍💻 Developer: ${config.developer}`);
    console.log(`  👑 Owners: ${OWNER_NUMBERS.join(', ')}`);
    console.log(`  🌐 ${config.portfolio}`);
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
