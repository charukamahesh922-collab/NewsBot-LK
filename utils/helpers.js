// utils/helpers.js

const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// ============================================================
// 🤖 SOCKET & OWNER STATE
// ============================================================

let _sock = null;
let _ownerJid = null;
let _ownerNumbers = [];

const setSock = (s) => { _sock = s; };
const getSock = () => _sock;
const setOwnerJid = (jid) => { _ownerJid = jid; };
const getOwnerJid = () => _ownerJid;

const setOwnerNumbers = (numbers) => { 
    _ownerNumbers = Array.isArray(numbers) ? numbers : [numbers];
    console.log('👑 Owner numbers set:', _ownerNumbers);
};
const getOwnerNumbers = () => _ownerNumbers;

// ============================================================
// 💾 MEDIA FUNCTIONS
// ============================================================

async function saveMediaToFile(msg, folder, prefix = '') {
    try {
        if (!folder) {
            console.error('❌ saveMediaToFile: folder is undefined!');
            return null;
        }
        
        const message = msg.message || {};
        
        let mediaMessage = null;
        let ext = '';
        let type = '';
        
        if (message.imageMessage) {
            mediaMessage = message.imageMessage;
            ext = '.jpg';
            type = 'image';
        } else if (message.videoMessage) {
            mediaMessage = message.videoMessage;
            ext = '.mp4';
            type = 'video';
        } else if (message.audioMessage) {
            mediaMessage = message.audioMessage;
            ext = '.mp3';
            type = 'audio';
        } else if (message.documentMessage) {
            mediaMessage = message.documentMessage;
            ext = path.extname(mediaMessage.fileName || '.pdf');
            type = 'document';
        } else {
            return null;
        }

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        const timestamp = Date.now();
        const sender = msg.key?.participant?.split('@')[0] || 'unknown';
        const filename = `${prefix}${prefix ? '_' : ''}status_${sender}_${timestamp}${ext}`;
        const filepath = path.join(folder, filename);

        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
                logger: {
                    info: () => {},
                    error: () => {},
                    warn: () => {}
                },
                reuploadRequest: _sock?.updateMediaMessage
            }
        );

        if (!buffer || buffer.length < 100) {
            return null;
        }

        fs.writeFileSync(filepath, buffer);

        return {
            filename,
            path: filepath,
            size: buffer.length,
            type,
            sender
        };

    } catch (error) {
        console.error('❌ saveMediaToFile error:', error.message);
        return null;
    }
}

async function getStatusMedia(msg) {
    try {
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
                logger: {
                    info: () => {},
                    error: () => {},
                    warn: () => {}
                },
                reuploadRequest: _sock?.updateMediaMessage
            }
        );
        return buffer;
    } catch (error) {
        console.error('❌ Error getting status media:', error.message);
        return null;
    }
}

// ============================================================
// 🎨 BEAUTIFUL UI HELPERS
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

const footer = () => {
    return [
        '',
        '━'.repeat(25),
        '⚡ *Powered by Charuka Mahesh*',
        '🦄💝 *NewsBot LK* 💝🦄'
    ].join('\n');
};

const beautifulHeader = (title = 'NewsBot LK') => {
    return [
        '╭' + '─'.repeat(38) + '╮',
        '┃     💝 *' + title + '* 💝     ┃',
        '┃  🦄 ✨ *Sri Lanka\'s #1* ✨ 🦄  ┃',
        '┃    *WhatsApp News Bot*     ┃',
        '╰' + '─'.repeat(38) + '╯',
        ''
    ].join('\n');
};

const sectionDivider = (title, emoji = '✦') => {
    const line = '─'.repeat(8);
    return '\n' + emoji + ' ' + line + ' *' + title + '* ' + line + ' ' + emoji + '\n';
};

const statusBadge = (enabled) => {
    return enabled ? '✅ *ON*' : '❌ *OFF*';
};

const modeEmoji = (mode) => {
    const emojis = {
        private: '🔒',
        inbox: '📥',
        groups: '👥',
        public: '🌍'
    };
    return emojis[mode] || '🌍';
};

// ============================================================
// 🧹 TEXT CLEANING & FORMATTING
// ============================================================

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
        .replace(/\s+/g, ' ')
        .trim();
};

const truncate = (text, maxLength = 5000) => {
    if (!text || text.length <= maxLength) return text;
    const shortened = text.substring(0, maxLength);
    const breakPoints = [
        shortened.lastIndexOf('. '),
        shortened.lastIndexOf('? '),
        shortened.lastIndexOf('! '),
        shortened.lastIndexOf('\n'),
        shortened.lastIndexOf('। '),
        shortened.lastIndexOf('...')
    ].filter(pos => pos > maxLength * 0.6);
    if (breakPoints.length > 0) {
        return shortened.substring(0, Math.max(...breakPoints) + 1).trim();
    }
    const lastSpace = shortened.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
        return shortened.substring(0, lastSpace).trim() + '...';
    }
    return shortened.trim() + '...';
};

const escapeMarkdown = (text) => {
    if (!text) return '';
    const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    let escaped = text;
    specialChars.forEach(char => {
        escaped = escaped.replace(new RegExp('\\' + char, 'g'), '\\' + char);
    });
    return escaped;
};

// ============================================================
// 🎲 RANDOM UTILITIES
// ============================================================

const randEmoji = (reactions) => {
    if (!reactions || !reactions.length) return '📰';
    return reactions[Math.floor(Math.random() * reactions.length)];
};

const randomItem = (array) => {
    if (!array || !array.length) return null;
    return array[Math.floor(Math.random() * array.length)];
};

const randomId = (length = 8) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// ============================================================
// ⏰ TIME & DATE UTILITIES
// ============================================================

const timeAgo = (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
    if (hours > 0) return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
    if (minutes > 0) return minutes + ' minute' + (minutes > 1 ? 's' : '') + ' ago';
    return 'Just now';
};

const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

// ============================================================
// 🔐 AUTHENTICATION & PERMISSIONS
// ============================================================

const isOwner = (senderNum, sender, ownerNumbers, ownerJid) => {
    const cleanNumber = senderNum.replace(/[^0-9]/g, '');
    if (ownerNumbers && ownerNumbers.some(num => num.replace(/[^0-9]/g, '') === cleanNumber)) {
        return true;
    }
    if (ownerJid && sender === ownerJid) return true;
    if (ownerJid && ownerJid.split('@')[0].replace(/[^0-9]/g, '') === cleanNumber) return true;
    return false;
};

const canUseBot = async (jid, isOwner, db) => {
    if (isOwner) return true;
    const mode = await db.get('botMode', 'public');
    const isGroup = jid.endsWith('@g.us');
    switch (mode) {
        case 'private': return false;
        case 'inbox': return !isGroup;
        case 'groups': return isGroup;
        case 'public':
        default: return true;
    }
};

const checkAdmin = async (sock, jid, sender) => {
    try {
        const metadata = await sock.groupMetadata(jid);
        const participant = metadata.participants.find(p => p.id === sender);
        return participant?.admin != null;
    } catch (error1) {
        try {
            const group = await sock.groupGetInfo(jid);
            const participant = group.participants.find(p => p.id === sender);
            return participant?.admin != null;
        } catch (error2) {
            try {
                const allGroups = await sock.groupFetchAllParticipating();
                const group = allGroups[jid];
                if (group) {
                    const participant = group.participants.find(p => p.id === sender);
                    return participant?.admin != null;
                }
                return false;
            } catch (error3) {
                console.error('❌ All admin check methods failed:', error3.message);
                return false;
            }
        }
    }
};

// ============================================================
// 📊 NUMBER FORMATTING
// ============================================================

const formatNumber = (num) => {
    return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
};

const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};

// ============================================================
// 📁 FILE UTILITIES
// ============================================================

const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const getExtension = (filename) => {
    return path.extname(filename).toLowerCase();
};

// ============================================================
// 🔗 URL UTILITIES
// ============================================================

const hasLink = (text) => {
    const linkRegex = /https?:\/\/(?:chat\.whatsapp\.com|t\.me|discord\.gg|wa\.me)/i;
    return linkRegex.test(text);
};

const extractUrls = (text) => {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    return text.match(urlRegex) || [];
};

// ============================================================
// 🎨 EMOJI COLLECTIONS
// ============================================================

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

// ============================================================
// 📤 EXPORTS
// ============================================================

module.exports = {
    // Socket & Owner State
    setSock,
    getSock,
    setOwnerJid,
    getOwnerJid,
    setOwnerNumbers,
    getOwnerNumbers,

    // Media Functions
    saveMediaToFile,
    getStatusMedia,

    // UI Helpers
    beautifulFooter,
    footer,
    beautifulHeader,
    sectionDivider,
    statusBadge,
    modeEmoji,

    // Text Utilities
    cleanText,
    truncate,
    escapeMarkdown,

    // Random Utilities
    randEmoji,
    randomItem,
    randomId,

    // Time Utilities
    timeAgo,
    formatDate,
    formatTime,

    // Auth & Permissions
    isOwner,
    canUseBot,
    checkAdmin,

    // Number Formatting
    formatNumber,
    formatSize,

    // File Utilities
    ensureDir,
    getExtension,

    // URL Utilities
    hasLink,
    extractUrls,

    // Emoji Collections
    EMOJIS
};
