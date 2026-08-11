// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🦄 Configuration File 🦄                   ║
// ║              Developed by Charuka Mahesh                     ║
// ║     Dedicated to Umesha Sathyanjali | Mithila | Sharada     ║
// ║                  Version: 9.0.4 ✨                           ║
// ╚══════════════════════════════════════════════════════════════╝

const config = {
    // ═══════════════════════════════════════
    // 👑 OWNER NUMBERS
    // ═══════════════════════════════════════
    ownerNumber: [
        '',
        '',
        ''
    ],

    // ═══════════════════════════════════════
    // 📰 NEWS GROUP JID
    // ═══════════════════════════════════════
    newsGroupJid: '',
    
    // ═══════════════════════════════════════
    // 📱 STATUS/TIKTOK GROUP JID
    // ═══════════════════════════════════════
    statusGroupJid: '',
    
    // ═══════════════════════════════════════
    // ⏱️ CHECK INTERVALS
    // ═══════════════════════════════════════
    checkIntervalMs: 120000,        // News: 2 minutes
    tiktokIntervalMs: 300000,       // TikTok: 5 minutes
    statusCheckIntervalMs: 1000,    // Status check: 5 seconds

    // ═══════════════════════════════════════
    // ⚙️ DEFAULT SETTINGS
    // ═══════════════════════════════════════
    defaults: {
        prefix: '.',
        botMode: 'public',
        
        // Auto Features
        autoNewsEnabled: true,           // Auto news every 2 min
        autoStatusView: true,            // Auto view statuses
        autoStatusReact: true,           // Auto react to statuses
        autoStatusSave: false,           // Auto save status media
        tiktokAutoEnabled: true,         // Auto TikTok videos
        autoBioEnabled: false,           // Auto update bio
        
        // Security
        antiLinkEnabled: false,          // Delete WhatsApp links
        antiSpamEnabled: false,          // Anti-spam
        antiBadWordEnabled: false,       // Anti-bad words
        
        // Voice
        voiceReplyEnabled: true,         // Auto voice replies in DM
        
        // Group
        welcomeEnabled: false,           // Welcome new members
        goodbyeEnabled: false,           // Goodbye leaving members
        slowModeEnabled: false,          // Slow mode
    },

    // ═══════════════════════════════════════
    // 🤖 BOT INFO
    // ═══════════════════════════════════════
    botName: 'NewsBot LK',
    developer: 'Charuka Mahesh',
    team: 'Umesha Sathyanjali & Mithila & Sharada',
    email: 'charukamahesh922@gmail.com',
    github: 'https://github.com/charukamahesh922-collab',
    portfolio: 'https://charukamahesh922-collab.github.io/protifilo/',
    tagline: "Sri Lanka's #1 WhatsApp News Bot",
    version: '9.0.4',
    year: '2026',

    // ═══════════════════════════════════════
    // 🖼️ IMAGES
    // ═══════════════════════════════════════
    botLogo: 'https://raw.githubusercontent.com/charukamahesh922-collab/NewsBot-LK/refs/heads/main/Assetes/botnews.png',
    fallbackImage: 'https://raw.githubusercontent.com/charukamahesh922-collab/NewsBot-LK/refs/heads/main/Assetes/botnews.png',

    // ═══════════════════════════════════════
    // 🎨 REACTIONS & EMOJIS
    // ═══════════════════════════════════════
    reactions: ['📰','🔥','👍','💯','👏','🏆','⭐','📢','❤️','💙'],
    statusEmojis: ['🖤','❤️','🔥','👍','💯','👏','😍','✨','🌟','💫'],

    // ═══════════════════════════════════════
    // 🗄️ DATABASE
    // ═══════════════════════════════════════
    mongoInternal: process.env.MONGO_URL || '',
    mongoPublic: process.env.MONGO_PUBLIC_URL || '',
    dbName: 'newsbot_db',
    
    // ═══════════════════════════════════════
    // 🔑 API KEYS
    // ═══════════════════════════════════════
    rapidApiKey: '',
    removeBgKey: process.env.REMOVE_BG_KEY || '',
};

module.exports = config;
