// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🦄 Configuration File 🦄                   ║
// ║              Developed by Charuka Mahesh                     ║
// ║     Dedicated to Umesha Sathyanjali | Mithila | Sharada     ║
// ╚══════════════════════════════════════════════════════════════╝

const config = {
    // ═══════════════════════════════════════
    // 👑 OWNER NUMBERS
    // ═══════════════════════════════════════
    ownerNumber: [
        '94784745155',
        '235304447422707',
        '209397624127632'
    ],

    // ═══════════════════════════════════════
    // 📰 NEWS GROUP
    // ═══════════════════════════════════════
    newsGroupJid: '120363430619499914@g.us',
    checkIntervalMs: 120000, // 2 minutes

    // ═══════════════════════════════════════
    // ⚙️ DEFAULTS
    // ═══════════════════════════════════════
    defaults: {
        prefix: '.',
        botMode: 'public',
        autoNewsEnabled: false,
        autoStatusView: true,
        autoStatusReact: true,
        autoStatusSave: false,
        antiLinkEnabled: false,
        antiSpamEnabled: false,
        antiBadWordEnabled: false,
        voiceReplyEnabled: true,
        autoBioEnabled: true,
        welcomeEnabled: false,
        goodbyeEnabled: false,
        slowModeEnabled: false,
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
    version: '9.0.2',
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
};

module.exports = config;
