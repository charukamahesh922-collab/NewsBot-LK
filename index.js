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
// 🎵 LOAD VOICE REPLIES FROM JSON
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
const CHECK_INTERVAL_MS = config.checkIntervalMs || 60000;
const BOT_LOGO = config.botLogo || 'https://i.imgur.com/3X4ZQ8x.png';
const FALLBACK_IMAGE = config.fallbackImage || 'https://i.imgur.com/3X4ZQ8x.png';
const REACTIONS = ['🔥', '📰', '💝', '🦄', '✨', '🌟', '💫', '🌈', '🎉', '💖'];

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
// 🗄️ JSON DATABASE
// ============================================================
const JSON_DB_FILE = path.join(__dirname, 'database.json');

let jsonDb = {
    settings: {
        botMode: 'public',
        prefix: '.',
        autoNewsEnabled: true,
        autoStatusView: true,
        autoStatusReact: true,
        voiceReplyEnabled: true,
        autoBioEnabled: true,
        buttonMenuEnabled: true,
        antiLinkEnabled: false,
        antiViewOnce: false,
        welcomeEnabled: false,
        goodbyeEnabled: false,
        welcomeMessage: '👋 Welcome @user! 🎉',
        goodbyeMessage: '👋 Goodbye @user! 😢'
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
console.log('🗄️ Using JSON Database');

// ============================================================
// 🗃️ DATABASE OPERATIONS
// ============================================================
const db = {
    get: async (key, defaultValue) => {
        return jsonDb.settings[key] ?? defaultValue;
    },
    set: async (key, value) => {
        console.log(`💾 DB SET: ${key} = ${value}`);
        jsonDb.settings[key] = value;
        saveJsonDb();
        return true;
    },
    all: async () => {
        return { ...jsonDb.settings };
    },
    warnAdd: async (userId, groupId) => {
        const key = `${userId}_${groupId}`;
        jsonDb.warnings[key] = (jsonDb.warnings[key] || 0) + 1;
        saveJsonDb();
        return jsonDb.warnings[key];
    },
    warnClear: async (userId, groupId) => {
        delete jsonDb.warnings[`${userId}_${groupId}`];
        saveJsonDb();
        return true;
    },
    banAdd: async (userId, reason = '') => {
        if (!jsonDb.bans.find(b => b.userId === userId)) {
            jsonDb.bans.push({ userId, reason, bannedAt: new Date().toISOString() });
            saveJsonDb();
        }
        return true;
    },
    banRemove: async (userId) => {
        jsonDb.bans = jsonDb.bans.filter(b => b.userId !== userId);
        saveJsonDb();
        return true;
    },
    banCheck: async (userId) => {
        return jsonDb.bans.some(b => b.userId === userId);
    },
    banAll: async () => {
        return jsonDb.bans;
    },
    afkSet: async (userId, reason) => {
        jsonDb.afk[userId] = { userId, reason, afkAt: new Date().toISOString() };
        saveJsonDb();
        return true;
    },
    afkRemove: async (userId) => {
        delete jsonDb.afk[userId];
        saveJsonDb();
        return true;
    },
    afkGet: async (userId) => {
        return jsonDb.afk[userId] || null;
    },
    groupGet: async (groupId, key, defaultValue) => {
        return jsonDb.groupSettings[groupId]?.[key] ?? defaultValue;
    },
    groupSet: async (groupId, key, value) => {
        if (!jsonDb.groupSettings[groupId]) {
            jsonDb.groupSettings[groupId] = {};
        }
        jsonDb.groupSettings[groupId][key] = value;
        saveJsonDb();
        return true;
    },
    urlsGet: async () => {
        return jsonDb.sentUrls || [];
    },
    urlsAdd: async (url) => {
        if (!jsonDb.sentUrls.includes(url)) {
            jsonDb.sentUrls.push(url);
            saveJsonDb();
        }
        return true;
    },
    urlsCount: async () => {
        return jsonDb.sentUrls.length;
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

const beautifulHeader = () => {
    return [
        '╭' + '─'.repeat(38) + '╮',
        '┃     💝 *NewsBot LK* 💝     ┃',
        '┃  🦄 ✨ *Sri Lanka\'s #1* ✨ 🦄  ┃',
        '┃    *WhatsApp News Bot*     ┃',
        '╰' + '─'.repeat(38) + '╯'
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

async function canUseBot(jid, isUserOwner) {
    return true; // Everyone can use
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
// 📥 MEDIA FUNCTIONS
// ============================================================

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

// ============================================================
// 🎵 VOICE REPLY HANDLER - Skip Owner
// ============================================================
async function handleVoiceReply(jid, text, msg, isUserOwner) {
    // 🚫 SKIP OWNER - Don't send voice to owner
    if (isUserOwner) {
        console.log(`👑 Owner (${jid}) - Voice reply skipped`);
        return false;
    }
    
    // Check if voice replies are enabled
    if (!await db.get('voiceReplyEnabled', true)) {
        console.log('🔇 Voice replies disabled');
        return false;
    }
    
    // Check if we have voice replies loaded
    if (!voiceReplies.replies || Object.keys(voiceReplies.replies).length === 0) {
        console.log('⚠️ No voice replies loaded');
        return false;
    }

    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);

    // Loop through all voice triggers
    for (const [trigger, url] of Object.entries(voiceReplies.replies)) {
        const triggerLower = trigger.toLowerCase();
        
        // Check if text matches trigger
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
// 📰 NEWS SYSTEM
// ============================================================

async function scrapeArticle(url) {
    try {
        const { data: html } = await axios.get(url, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!html) return { description: '', image: '' };

        let image = '';
        const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogMatch?.[1]) image = ogMatch[1];

        const cleanHtml = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '');

        let description = '';
        const paragraphs = cleanHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        if (paragraphs) {
            description = paragraphs
                .map(p => p.replace(/<[^>]*>/g, '').trim())
                .filter(p => p.length > 30)
                .join('\n\n');
        }

        return {
            description: cleanText(description || ''),
            image: image
        };
    } catch {
        return { description: '', image: '' };
    }
}

function cleanText(text) {
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
}

function truncate(text, maxLength = 5000) {
    if (!text || text.length <= maxLength) return text;
    const shortened = text.substring(0, maxLength);
    const lastSpace = shortened.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
        return shortened.substring(0, lastSpace).trim() + '...';
    }
    return shortened.trim() + '...';
}

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
                    let desc = description || article.content || title;
                    desc = String(desc).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
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

async function fetchAllLatestNews() {
    const sources = [
        { name: 'Hiru', fetch: fetchHiruNews },
        { name: 'Derana', fetch: fetchDeranaNews },
    ];

    const results = await Promise.allSettled(sources.map(s => s.fetch()));
    const allNews = [];
    
    sources.forEach((source, index) => {
        if (results[index].status === 'fulfilled' && Array.isArray(results[index].value)) {
            allNews.push(...results[index].value);
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

    return uniqueNews;
}

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
        
        if (article.image && article.image.length > 10) {
            try {
                sent = await sock.sendMessage(jid, {
                    image: { url: article.image },
                    caption: caption,
                    mimetype: 'image/jpeg'
                });
            } catch (e) {
                console.log('⚠️ Image failed, sending text only');
            }
        }
        
        if (!sent) {
            sent = await sock.sendMessage(jid, { text: caption });
        }
        
        await sock.sendMessage(jid, {
            react: { text: randEmoji(REACTIONS), key: sent.key }
        });
        return true;
    } catch (e) {
        console.error('❌ Send news error:', e.message);
        return false;
    }
}

async function checkAndShareAllNewNews() {
    if (!sock?.user) return;
    if (await db.groupGet(NEWS_GROUP_JID, 'isMuted', false)) return;

    try {
        const allNews = await fetchAllLatestNews();
        if (!allNews.length) return;

        const sentUrls = await db.urlsGet();

        if (!sentUrls.length) {
            for (const article of allNews) {
                if (article.url) await db.urlsAdd(article.url);
            }
            return;
        }

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
// 🎨 BEAUTIFUL MENU DISPLAYS
// ============================================================

async function sendBeautifulMenu(sock, jid, db, config, owner, admin, isGroup, prefix) {
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
            ''
        );
    }

    if (owner) {
        menuLines.push(
            sectionDivider('👑 OWNER SUITE', '💎'),
            '  ✦ ' + prefix + 'settings        ─ All Settings',
            '  ✦ ' + prefix + 'mode public     ─ Bot Mode',
            '  ✦ ' + prefix + 'autonews on/off  ─ Auto News',
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

async function sendBeautifulStats(sock, jid, db, config) {
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

async function sendBeautifulSettings(sock, jid, db, isOwner, config) {
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

    const msg = [
        '╔' + '═'.repeat(40) + '╗',
        '║     💝 *NEWS BOT LK* 💝        ║',
        '║  🦄 ✨ *Successfully* ✨ 🦄    ║',
        '║      *Connected!*             ║',
        '╚' + '═'.repeat(40) + '╝',
        '',
        '┌' + '─'.repeat(36) + '┐',
        '│  ✅ *Status:* Online          │',
        '│  🌍 *Mode:* PUBLIC            │',
        '│  🎵 *Voice:* ' + statusBadge(await db.get('voiceReplyEnabled', true)) + '        │',
        '│  📋 *.menu:* Show Menu        │',
        '│  ⚙️ *.settings:* Settings     │',
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
    } catch (e) {
        await sock.sendMessage(ownerJid, { text: msg });
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
        DisconnectReason
    } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(
        path.join(__dirname, 'auth_info_baileys')
    );

    sock = makeWASocket({
        auth: state,
        browser: ['NewsBot LK', 'Chrome', '9.0.0'],
        connectTimeoutMs: 30000,
        printQRInTerminal: false
    });

    // ============================================================
    // 📨 MESSAGE HANDLER
    // ============================================================
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;

            const jid = msg.key.remoteJid;

            if (jid === 'status@broadcast') {
                continue;
            }

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

            console.log(`📩 [${senderNum}] [${isGroup ? 'GROUP' : 'DM'}] "${lower}" | Owner: ${isUserOwner}`);

            // Check ban
            if (await db.banCheck(sender) && !isUserOwner) {
                console.log(`🚫 Banned user blocked: ${senderNum}`);
                continue;
            }

            // ============================================================
            // 🎵 VOICE REPLIES (DM Only) - Skip Owner
            // ============================================================
            if (!isGroup && await db.get('voiceReplyEnabled', true)) {
                const voiceSent = await handleVoiceReply(jid, text, msg, isUserOwner);
                if (voiceSent) {
                    console.log(`✅ Voice sent to non-owner: ${senderNum}`);
                    continue;
                }
            }

            // ============================================================
            // 📋 MENU COMMAND
            // ============================================================
            if (lower === '.menu' || lower === `${prefix}menu` || lower === 'menu') {
                console.log(`📋 Showing menu to: ${senderNum}`);
                await sendBeautifulMenu(sock, jid, db, config, isUserOwner, isAdmin, isGroup, prefix);
                continue;
            }

            // ============================================================
            // 📊 STATS COMMAND
            // ============================================================
            if (lower === '.stats' || lower === `${prefix}stats` || lower === 'stats') {
                console.log(`📊 Stats requested by: ${senderNum}`);
                await sendBeautifulStats(sock, jid, db, config);
                continue;
            }

            // ============================================================
            // 📰 NEWS COMMAND
            // ============================================================
            if (lower === '.news' || lower === `${prefix}news` || lower === 'news') {
                console.log(`📰 News requested by: ${senderNum}`);
                await sock.sendMessage(jid, {
                    text: '📰 *Fetching latest news...*\n⏳ Please wait...' + beautifulFooter()
                });
                await checkAndShareAllNewNews();
                continue;
            }

            // ============================================================
            // ⚙️ SETTINGS - Owner Only
            // ============================================================
            if (lower === '.settings' || lower === `${prefix}settings` || lower === 'settings') {
                console.log(`⚙️ Settings requested by: ${senderNum}`);
                await sendBeautifulSettings(sock, jid, db, isUserOwner, config);
                continue;
            }

            // ============================================================
            // 🎵 TOGGLE COMMANDS
            // ============================================================
            if (canToggle) {
                if (lower === '.voice on' || lower === `${prefix}voice on`) {
                    await db.set('voiceReplyEnabled', true);
                    await sock.sendMessage(jid, { text: '🎵 *Voice: ON* ✅\n\n' + beautifulFooter() });
                    continue;
                }
                if (lower === '.voice off' || lower === `${prefix}voice off`) {
                    await db.set('voiceReplyEnabled', false);
                    await sock.sendMessage(jid, { text: '🎵 *Voice: OFF* ❌\n\n' + beautifulFooter() });
                    continue;
                }
                if (lower === '.antilink on' || lower === `${prefix}antilink on`) {
                    await db.set('antiLinkEnabled', true);
                    await sock.sendMessage(jid, { text: '🔗 *Anti-Link: ON* ✅\n\n' + beautifulFooter() });
                    continue;
                }
                if (lower === '.antilink off' || lower === `${prefix}antilink off`) {
                    await db.set('antiLinkEnabled', false);
                    await sock.sendMessage(jid, { text: '🔗 *Anti-Link: OFF* ❌\n\n' + beautifulFooter() });
                    continue;
                }
            }

            // ============================================================
            // 👑 OWNER COMMANDS
            // ============================================================
            if (isUserOwner) {
                if (lower === '.mode' || lower.startsWith('.mode ') || 
                    lower === `${prefix}mode` || lower.startsWith(`${prefix}mode `)) {
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
                    continue;
                }

                if (lower === '.autonews on' || lower === `${prefix}autonews on`) {
                    await db.set('autoNewsEnabled', true);
                    await sock.sendMessage(jid, { text: '📰 *Auto News: ON* ✅\n\n' + beautifulFooter() });
                    continue;
                }
                if (lower === '.autonews off' || lower === `${prefix}autonews off`) {
                    await db.set('autoNewsEnabled', false);
                    await sock.sendMessage(jid, { text: '📰 *Auto News: OFF* ❌\n\n' + beautifulFooter() });
                    continue;
                }

                if (lower.startsWith('.ban ') || lower.startsWith(`${prefix}ban `)) {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (mentioned?.length) {
                        await db.banAdd(mentioned[0]);
                        await sock.sendMessage(jid, {
                            text: '🚫 @' + mentioned[0].split('@')[0] + ' *banned!*\n\n' + beautifulFooter(),
                            mentions: [mentioned[0]]
                        });
                    }
                    continue;
                }
                if (lower.startsWith('.unban ') || lower.startsWith(`${prefix}unban `)) {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (mentioned?.length) {
                        await db.banRemove(mentioned[0]);
                        await sock.sendMessage(jid, {
                            text: '✅ @' + mentioned[0].split('@')[0] + ' *unbanned!*\n\n' + beautifulFooter(),
                            mentions: [mentioned[0]]
                        });
                    }
                    continue;
                }
                if (lower === '.banlist' || lower === `${prefix}banlist`) {
                    const bans = await db.banAll();
                    if (!bans.length) {
                        await sock.sendMessage(jid, { text: '✅ *No bans!*\n\n' + beautifulFooter() });
                    } else {
                        const banList = bans.map((b, i) => (i + 1) + '. @' + b.userId.split('@')[0]).join('\n');
                        await sock.sendMessage(jid, {
                            text: '🚫 *Banned (' + bans.length + ')*\n' + banList + '\n\n' + beautifulFooter(),
                            mentions: bans.map(b => b.userId)
                        });
                    }
                    continue;
                }

                if (lower.startsWith('.setprefix ') || lower.startsWith(`${prefix}setprefix `)) {
                    const newPrefix = text.replace('.setprefix', '').replace(`${prefix}setprefix`, '').trim();
                    if (newPrefix.length >= 1 && newPrefix.length <= 3) {
                        await db.set('prefix', newPrefix);
                        await sock.sendMessage(jid, {
                            text: '🔧 *Prefix: "' + newPrefix + '"*\n💡 Use *' + newPrefix + 'menu*\n\n' + beautifulFooter()
                        });
                    }
                    continue;
                }
            }

            // ============================================================
            // 👥 GROUP COMMANDS
            // ============================================================
            if (isGroup) {
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
                    continue;
                }

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
                    continue;
                }

                if (lower === '.tagall' || lower === `${prefix}tagall` || lower === '.everyone') {
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const sent = await sock.sendMessage(jid, {
                            text: '📢 *Everyone!*\n\n' + beautifulFooter(),
                            mentions: metadata.participants.map(p => p.id)
                        });
                        await sock.sendMessage(jid, { react: { text: '📢', key: sent.key } });
                    } catch {}
                    continue;
                }

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
                    continue;
                }

                if (lower.startsWith('.afk') || lower.startsWith(`${prefix}afk`)) {
                    const reason = text.replace('.afk', '').replace(`${prefix}afk`, '').trim() || 'AFK';
                    await db.afkSet(sender, reason);
                    const sent = await sock.sendMessage(jid, {
                        text: '💤 @' + sender.split('@')[0] + ' *AFK:* ' + reason + '\n\n' + beautifulFooter(),
                        mentions: [sender]
                    });
                    await sock.sendMessage(jid, { react: { text: '💤', key: sent.key } });
                    continue;
                }

                // ============================================================
                // 🛡️ GROUP ADMIN COMMANDS
                // ============================================================
                if (isAdmin || isUserOwner) {
                    if (lower === '.mute' || lower === `${prefix}mute`) {
                        await db.groupSet(jid, 'isMuted', true);
                        await sock.sendMessage(jid, { text: '🔇 *Group Muted for 30 minutes*\n\n' + beautifulFooter() });
                        setTimeout(async () => {
                            await db.groupSet(jid, 'isMuted', false);
                        }, 30 * 60 * 1000);
                        continue;
                    }
                    if (lower === '.unmute' || lower === `${prefix}unmute`) {
                        await db.groupSet(jid, 'isMuted', false);
                        await sock.sendMessage(jid, { text: '🔊 *Group Unmuted!*\n\n' + beautifulFooter() });
                        continue;
                    }
                    if (lower.startsWith('.warn ') || lower.startsWith(`${prefix}warn `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            const count = await db.warnAdd(mentioned[0], jid);
                            await sock.sendMessage(jid, {
                                text: '⚠️ *Warning for @' + mentioned[0].split('@')[0] + '*\n📊 Count: *' + count + '/3*\n\n' + beautifulFooter(),
                                mentions: [mentioned[0]]
                            });
                            if (count >= 3) {
                                try {
                                    await sock.groupParticipantsUpdate(jid, [mentioned[0]], 'remove');
                                    await db.warnClear(mentioned[0], jid);
                                    await sock.sendMessage(jid, {
                                        text: '🚫 @' + mentioned[0].split('@')[0] + ' removed (3 warnings)*\n\n' + beautifulFooter(),
                                        mentions: [mentioned[0]]
                                    });
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
                                await sock.sendMessage(jid, {
                                    text: '🚫 @' + mentioned[0].split('@')[0] + ' *kicked!*\n\n' + beautifulFooter(),
                                    mentions: [mentioned[0]]
                                });
                            } catch (e) {
                                await sock.sendMessage(jid, { text: '❌ *Failed to kick user!*\n\n' + beautifulFooter() });
                            }
                        }
                        continue;
                    }
                    if (lower.startsWith('.add ') || lower.startsWith(`${prefix}add `)) {
                        const number = text.replace('.add', '').replace(`${prefix}add`, '').trim().replace(/[^0-9]/g, '');
                        if (number) {
                            try {
                                await sock.groupParticipantsUpdate(jid, [number + '@s.whatsapp.net'], 'add');
                                await sock.sendMessage(jid, { text: '✅ *' + number + ' added!*\n\n' + beautifulFooter() });
                            } catch (e) {
                                await sock.sendMessage(jid, { text: '❌ *Failed to add user!*\n\n' + beautifulFooter() });
                            }
                        }
                        continue;
                    }
                    if (lower.startsWith('.promote ') || lower.startsWith(`${prefix}promote `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            try {
                                await sock.groupParticipantsUpdate(jid, [mentioned[0]], 'promote');
                                await sock.sendMessage(jid, {
                                    text: '👑 @' + mentioned[0].split('@')[0] + ' *promoted!*\n\n' + beautifulFooter(),
                                    mentions: [mentioned[0]]
                                });
                            } catch (e) {
                                await sock.sendMessage(jid, { text: '❌ *Failed to promote user!*\n\n' + beautifulFooter() });
                            }
                        }
                        continue;
                    }
                    if (lower.startsWith('.demote ') || lower.startsWith(`${prefix}demote `)) {
                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                        if (mentioned?.length) {
                            try {
                                await sock.groupParticipantsUpdate(jid, [mentioned[0]], 'demote');
                                await sock.sendMessage(jid, {
                                    text: '⬇️ @' + mentioned[0].split('@')[0] + ' *demoted!*\n\n' + beautifulFooter(),
                                    mentions: [mentioned[0]]
                                });
                            } catch (e) {
                                await sock.sendMessage(jid, { text: '❌ *Failed to demote user!*\n\n' + beautifulFooter() });
                            }
                        }
                        continue;
                    }
                }
            }

            // ============================================================
            // 💾 SAVE MEDIA
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
                        await sock.sendMessage(jid, { text: '❌ *Failed!*\n\n' + beautifulFooter() });
                    }
                } else {
                    await sock.sendMessage(jid, { text: '💡 Reply to media with *' + prefix + 'save*\n\n' + beautifulFooter() });
                }
                continue;
            }

            // ============================================================
            // 👁️ VIEW-ONCE SAVER
            // ============================================================
            if (lower === '.vv' || lower === `${prefix}vv` || lower === 'vv') {
                const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                if (contextInfo?.quotedMessage?.imageMessage?.viewOnce ||
                    contextInfo?.quotedMessage?.videoMessage?.viewOnce) {
                    const fakeMessage = {
                        key: { remoteJid: jid, id: contextInfo.stanzaId, participant: contextInfo.participant },
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
                    await sock.sendMessage(jid, { text: '💡 Reply to VV with *' + prefix + 'vv*\n\n' + beautifulFooter() });
                }
                continue;
            }

            // ============================================================
            // 🔗 ANTI-LINK DETECTION
            // ============================================================
            if (isGroup && await db.get('antiLinkEnabled', false) &&
                /https?:\/\/(?:chat\.whatsapp\.com|t\.me|discord\.gg)/i.test(text) &&
                !isAdmin && !isUserOwner) {
                try {
                    await sock.sendMessage(jid, { delete: msg.key });
                } catch (e) {}
                await sock.sendMessage(jid, {
                    text: '🔗 *Link Deleted!*\n👤 @' + sender.split('@')[0] + '\n\n' + beautifulFooter(),
                    mentions: [sender]
                });
                continue;
            }

            // ============================================================
            // 💤 AFK DETECTION
            // ============================================================
            if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                for (const mentioned of msg.message.extendedTextMessage.contextInfo.mentionedJid) {
                    const afkData = await db.afkGet(mentioned);
                    if (afkData) {
                        const minutes = Math.floor((Date.now() - new Date(afkData.afkAt).getTime()) / 60000);
                        await sock.sendMessage(jid, {
                            text: '💤 @' + mentioned.split('@')[0] + ' *AFK:* ' + afkData.reason +
                                  ' (' + minutes + 'm)\n\n' + beautifulFooter(),
                            mentions: [mentioned]
                        });
                    }
                }
            }

            if (await db.afkGet(sender) && !lower.startsWith('.afk') && !lower.startsWith(`${prefix}afk`)) {
                await db.afkRemove(sender);
            }
        }
    });

    // ============================================================
    // 👥 GROUP PARTICIPANT UPDATES
    // ============================================================
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
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
                console.log(`\n🔄 Reconnecting... Attempt ${reconnectAttempts}\n`);
                reconnectTimer = setTimeout(async () => {
                    reconnectTimer = null;
                    await startBot();
                }, Math.min(30000, 5000 * reconnectAttempts));
            } else {
                console.log('\n❌ Logged out!\n');
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
            console.log(`  👑 Owner: ${ownerJid}`);
            console.log(`  🦄 v${config.version || '9.0.0'}`);
            console.log(`  🌍 Mode: PUBLIC - Everyone can use!`);
            console.log(`  🎵 Voice Replies: ${Object.keys(voiceReplies.replies || {}).length} triggers loaded`);
            console.log(`  🔇 Voice disabled for owner`);
            console.log('═'.repeat(50) + '\n');

            if (ownerJid) {
                await sendConnectedMessage();
            }

            if (await db.get('autoNewsEnabled', true)) {
                await checkAndShareAllNewNews();
            }
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

    console.log('🦄💝 NewsBot LK is running in PUBLIC MODE! 💝🦄');
    console.log('🌍 Everyone can use the bot now!');
    console.log('📋 Try: .menu');
    console.log('🎵 Voice replies work for NON-OWNERS only');
    console.log('🎵 Try: gm, gn, hi, ily, bye, sad, happy, cry, love, thanks\n');
})();

// ============================================================
// 💝 END OF CODE - Made with ❤️ by Charuka Mahesh 💝
// ============================================================
