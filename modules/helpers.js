// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🛠️ Helper Functions 🛠️                      ║
// ║              Utility functions for the bot                   ║
// ╚══════════════════════════════════════════════════════════════╝

// ============================================================
// 🎨 BEAUTIFUL UI HELPERS
// ============================================================

/**
 * 💝 Beautiful Footer
 * Appears on ALL bot messages for consistent branding
 * @returns {string} - Styled footer text
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
 * Simple footer (compact version)
 * @returns {string} - Compact footer text
 */
const footer = () => {
    return [
        '',
        '━'.repeat(25),
        '⚡ *Powered by Charuka Mahesh*',
        '🦄💝 *NewsBot LK* 💝🦄'
    ].join('\n');
};

/**
 * 💝 Beautiful Header
 * Used for menus and information displays
 * @param {string} title - Header title
 * @returns {string} - Styled header text
 */
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

/**
 * 💝 Section Divider
 * Creates beautiful section separators
 * @param {string} title - Section title
 * @param {string} emoji - Emoji for the section
 * @returns {string} - Styled divider
 */
const sectionDivider = (title, emoji = '✦') => {
    const line = '─'.repeat(8);
    return '\n' + emoji + ' ' + line + ' *' + title + '* ' + line + ' ' + emoji + '\n';
};

/**
 * 💝 Status Badge
 * Shows ON/OFF status with emoji
 * @param {boolean} enabled - Status state
 * @returns {string} - Status badge text
 */
const statusBadge = (enabled) => {
    return enabled ? '✅ *ON*' : '❌ *OFF*';
};

/**
 * 💝 Mode Emoji
 * Returns emoji for bot mode
 * @param {string} mode - Bot mode
 * @returns {string} - Mode emoji
 */
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

/**
 * Clean HTML text
 * Removes scripts, styles, tags, and normalizes whitespace
 * @param {string} text - Raw HTML text
 * @returns {string} - Clean plain text
 */
const cleanText = (text) => {
    if (!text) return '';

    return text
        // Remove script tags
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        // Remove style tags
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        // Remove HTML tags
        .replace(/<[^>]*>/g, '')
        // Remove HTML comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Decode HTML entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        // Remove zero-width characters
        .replace(/&zwj;/gi, '')
        .replace(/&zwnj;/gi, '')
        .replace(/​/g, '')  // Zero-width space
        .replace(/‌/g, '')  // Zero-width non-joiner
        .replace(/‍/g, '')  // Zero-width joiner
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Smart text truncation
 * Truncates text at sentence boundaries for readability
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default: 5000)
 * @returns {string} - Truncated text
 */
const truncate = (text, maxLength = 5000) => {
    if (!text || text.length <= maxLength) return text;

    const shortened = text.substring(0, maxLength);

    // Try to break at sentence endings
    const breakPoints = [
        shortened.lastIndexOf('. '),
        shortened.lastIndexOf('? '),
        shortened.lastIndexOf('! '),
        shortened.lastIndexOf('\n'),
        shortened.lastIndexOf('। '),  // Sinhala full stop
        shortened.lastIndexOf('...')
    ].filter(pos => pos > maxLength * 0.6);

    if (breakPoints.length > 0) {
        return shortened.substring(0, Math.max(...breakPoints) + 1).trim();
    }

    // Fallback to word boundary
    const lastSpace = shortened.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
        return shortened.substring(0, lastSpace).trim() + '...';
    }

    return shortened.trim() + '...';
};

/**
 * Escape markdown special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
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

/**
 * Get random emoji from array
 * @param {string[]} reactions - Array of emojis
 * @returns {string} - Random emoji
 */
const randEmoji = (reactions) => {
    if (!reactions || !reactions.length) return '📰';
    return reactions[Math.floor(Math.random() * reactions.length)];
};

/**
 * Get random item from array
 * @param {Array} array - Input array
 * @returns {*} - Random item
 */
const randomItem = (array) => {
    if (!array || !array.length) return null;
    return array[Math.floor(Math.random() * array.length)];
};

/**
 * Generate random ID
 * @param {number} length - ID length
 * @returns {string} - Random ID
 */
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

/**
 * Format time difference (e.g., "5 minutes ago")
 * @param {Date|string} date - Date to compare
 * @returns {string} - Formatted time difference
 */
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

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date
 */
const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Format time for display
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted time
 */
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

/**
 * Check if sender is bot owner
 * @param {string} senderNum - Sender's phone number
 * @param {string} sender - Sender's JID
 * @param {string[]} ownerNumbers - Array of owner numbers
 * @param {string} ownerJid - Connected bot JID
 * @returns {boolean} - True if owner
 */
const isOwner = (senderNum, sender, ownerNumbers, ownerJid) => {
    const cleanNumber = senderNum.replace(/[^0-9]/g, '');

    // Check against configured owner numbers
    if (ownerNumbers && ownerNumbers.some(num => num.replace(/[^0-9]/g, '') === cleanNumber)) {
        return true;
    }

    // Check against connected WhatsApp JID
    if (ownerJid && sender === ownerJid) return true;
    if (ownerJid && ownerJid.split('@')[0].replace(/[^0-9]/g, '') === cleanNumber) return true;

    return false;
};

/**
 * Check if user can use bot based on mode
 * @param {string} jid - Chat JID
 * @param {boolean} isOwner - Is the user an owner?
 * @param {Object} db - Database instance
 * @returns {boolean} - True if user can use bot
 */
const canUseBot = async (jid, isOwner, db) => {
    // Owners can always use the bot
    if (isOwner) return true;

    const mode = await db.get('botMode', 'public');
    const isGroup = jid.endsWith('@g.us');

    switch (mode) {
        case 'private':
            // Bot disabled for everyone except owner
            return false;

        case 'inbox':
            // Only DMs allowed
            return !isGroup;

        case 'groups':
            // Only groups allowed
            return isGroup;

        case 'public':
        default:
            // Everyone can use
            return true;
    }
};

/**
 * Check if user is group admin
 * @param {Object} sock - WhatsApp socket
 * @param {string} jid - Group JID
 * @param {string} sender - Sender's JID
 * @returns {boolean} - True if admin
 */
const checkAdmin = async (sock, jid, sender) => {
    try {
        const metadata = await sock.groupMetadata(jid);
        const participant = metadata.participants.find(p => p.id === sender);
        return participant?.admin != null;
    } catch (error) {
        console.error('❌ Admin Check Error:', error.message);
        return false;
    }
};

// ============================================================
// 📊 NUMBER FORMATTING
// ============================================================

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
const formatNumber = (num) => {
    return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
};

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size
 */
const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};

// ============================================================
// 📁 FILE UTILITIES
// ============================================================

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Get file extension
 * @param {string} filename - Filename
 * @returns {string} - File extension
 */
const getExtension = (filename) => {
    return path.extname(filename).toLowerCase();
};

// ============================================================
// 🔗 URL UTILITIES
// ============================================================

/**
 * Check if text contains a link
 * @param {string} text - Text to check
 * @returns {boolean} - True if contains link
 */
const hasLink = (text) => {
    const linkRegex = /https?:\/\/(?:chat\.whatsapp\.com|t\.me|discord\.gg|wa\.me)/i;
    return linkRegex.test(text);
};

/**
 * Extract URLs from text
 * @param {string} text - Text to extract from
 * @returns {string[]} - Array of URLs
 */
const extractUrls = (text) => {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    return text.match(urlRegex) || [];
};

// ============================================================
// 🎨 EMOJI COLLECTIONS
// ============================================================

/**
 * Emoji categories for different moods
 */
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
