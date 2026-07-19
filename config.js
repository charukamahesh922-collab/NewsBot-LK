// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🦄 Configuration File 🦄                   ║
// ║              Developed by Charuka Mahesh                     ║
// ║     Dedicated to Umesha Sathyanjali | Mithila | Sharada     ║
// ╚══════════════════════════════════════════════════════════════╝

module.exports = {

    // ═══════════════════════════════════════════════════════════
    // 👑 BOT OWNER
    // ═══════════════════════════════════════════════════════════
    ownerNumber: [
        '',          // Primary Owner
        ''       // Secondary Owner (WhatsApp Web ID)
    ],

    // ═══════════════════════════════════════════════════════════
    // 📰 NEWS GROUP
    // ═══════════════════════════════════════════════════════════
    // All news will be sent to this group automatically
    newsGroupJid: '',

    // ═══════════════════════════════════════════════════════════
    // 🔄 CHECK INTERVAL
    // ═══════════════════════════════════════════════════════════
    // How often to check for new news (in milliseconds)
    // 120000ms = 2 minutes
    checkIntervalMs: 120000,

    // ═══════════════════════════════════════════════════════════
    // ⚙️ DEFAULT SETTINGS
    // ═══════════════════════════════════════════════════════════
    defaults: {

        // Command Prefix
        prefix: '.',

        // Bot Mode: 'private' | 'inbox' | 'groups' | 'public'
        botMode: 'public',

        // Button Menu (true = Native WhatsApp Buttons, false = Text Menu)
        buttonMenuEnabled: true,

        // Auto News Fetching
        autoNewsEnabled: true,

        // Auto Status View & React (NO forwarding for privacy)
        autoStatusView: true,
        autoStatusReact: true,

        // Anti-Link Protection (Deletes WhatsApp/Telegram/Discord links in groups)
        antiLinkEnabled: false,

        // Anti-Spam Protection
        antiSpamEnabled: false,

        // Skip View-Once Statuses
        antiViewOnce: false,

        // Voice Replies in DM (gm, gn, hi, ily, bye, etc.)
        voiceReplyEnabled: true,

        // Auto Update WhatsApp Bio (Every 30 minutes)
        autoBioEnabled: true,

        // Welcome Message for New Members
        welcomeEnabled: false,
        welcomeMessage: '👋 Welcome @user! 🎉',

        // Goodbye Message when Members Leave
        goodbyeEnabled: false,
        goodbyeMessage: '👋 Goodbye @user! 😢',
    },

    // ═══════════════════════════════════════════════════════════
    // 🎨 BRANDING
    // ═══════════════════════════════════════════════════════════
    botName: 'NewsBot LK',
    developer: 'Charuka Mahesh',
    team: 'Umesha Sathyanjali & Mithila & Sharada',
    email: 'charukamahesh922@gmail.com',
    github: 'https://github.com/charukamahesh922-collab',
    portfolio: 'https://charukamahesh922-collab.github.io/protifilo/',
    tagline: "Sri Lanka's #1 WhatsApp News Bot",
    version: '9.0.0',
    year: '2024',

    // ═══════════════════════════════════════════════════════════
    // 🖼️ BOT LOGO & IMAGES
    // ═══════════════════════════════════════════════════════════
    // Main bot logo (displayed in menus & settings)
    botLogo: 'https://raw.githubusercontent.com/charukamahesh922-collab/NewsBot-LK/refs/heads/main/Assetes/botnews.png',

    // Fallback image (used when news article has no image)
    fallbackImage: 'https://raw.githubusercontent.com/charukamahesh922-collab/Mahawilachchiya-Sports/refs/heads/main/dearan.jpeg',

    // ═══════════════════════════════════════════════════════════
    // 🎯 REACTION EMOJIS
    // ═══════════════════════════════════════════════════════════

    // Emojis used for news article reactions
    reactions: [
        '📰',   // Newspaper
        '🔥',   // Fire/Hot
        '👍',   // Thumbs Up
        '💯',   // 100
        '👏',   // Clap
        '🏆',   // Trophy
        '⭐',   // Star
        '📢',   // Announcement
        '❤️',   // Heart
        '💙'    // Blue Heart
    ],

    // Emojis used for WhatsApp status reactions
    statusEmojis: [
        '🖤',   // Black Heart
        '❤️',   // Red Heart
        '🔥',   // Fire
        '👍',   // Thumbs Up
        '💯',   // 100
        '👏',   // Clap
        '😍',   // Heart Eyes
        '✨',   // Sparkles
        '🌟',   // Glowing Star
        '💫'    // Dizzy/Star
    ],

    // ═══════════════════════════════════════════════════════════
    // 🗄️ MONGODB CONFIGURATION
    // ═══════════════════════════════════════════════════════════
    // Internal MongoDB URL (for Railway/Render internal network)
    mongoInternal: process.env.MONGO_URL ||
        '',

    // Public MongoDB URL (for external connections)
    mongoPublic: process.env.MONGO_PUBLIC_URL ||
        '',

    // Database Name
    dbName: 'newsbot_db',

};

// ═══════════════════════════════════════════════════════════════
// 📝 CONFIGURATION GUIDE
// ═══════════════════════════════════════════════════════════════
//
// 1. OWNER NUMBERS:
//    - Add your WhatsApp number with country code
//    - Example: '94784745155' for Sri Lanka (+94)
//
// 2. NEWS GROUP:
//    - Get group JID from group info or logs
//    - Format: '123456789@g.us'
//
// 3. BOT MODES:
//    - 'private': Bot disabled for everyone
//    - 'inbox': Only works in DMs
//    - 'groups': Only works in groups
//    - 'public': Works everywhere
//
// 4. MONGODB:
//    - Set MONGO_ENABLED=false in .env to use JSON file instead
//    - MongoDB is optional (auto-falls back to JSON)
//
// 5. INTERVALS:
//    - checkIntervalMs: 60000 = 1 min, 120000 = 2 min
//    - Bio updates every 30 minutes automatically
//
// ═══════════════════════════════════════════════════════════════
// 💝 Dedicated with love to:
// 🌸 Umesha Sathyanjali
// 🌸 Mithila
// 🌸 Sharada
// ═══════════════════════════════════════════════════════════════
