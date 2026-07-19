// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                   📋 Menu Module 📋                         ║
// ║         Button Menus, Text Menus & Settings                 ║
// ╚══════════════════════════════════════════════════════════════╝

const { 
    beautifulFooter, 
    beautifulHeader, 
    sectionDivider, 
    statusBadge, 
    modeEmoji 
} = require('./helpers');

// ============================================================
// 🎨 MENU CONSTANTS
// ============================================================

/**
 * Mode display emojis
 */
const MODE_EMOJIS = {
    private: '🔒',
    inbox: '📥',
    groups: '👥',
    public: '🌍'
};

/**
 * Menu section emojis
 */
const SECTION_EMOJIS = {
    news: '📡',
    media: '📦',
    group: '👑',
    admin: '⚔️',
    owner: '💎',
    voice: '🎤'
};

// ============================================================
// 🔘 BUTTON MENU (List Message)
// ============================================================

/**
 * 💝 Send Interactive Button Menu
 * Uses WhatsApp List Message for interactive buttons
 * 
 * @param {Object} sock - WhatsApp socket
 * @param {string} jid - Chat JID
 * @param {Object} db - Database instance
 * @param {Object} config - Bot configuration
 * @param {boolean} owner - Is user owner?
 * @param {boolean} admin - Is user admin?
 * @param {boolean} group - Is chat a group?
 * @param {string} prefix - Command prefix
 */
async function handleButtonMenu(sock, jid, db, config, owner, admin, group, prefix) {
    const mode = await db.get('botMode', 'public');
    const sections = [];

    // ═══════════════════════════════════════════════
    // 📰 MAIN MENU SECTION
    // ═══════════════════════════════════════════════
    sections.push({
        title: `💝 ${config.botName} - Main Menu`,
        rows: [
            {
                title: '📰 Latest News',
                description: 'Fetch latest news from 10+ Sri Lankan sources',
                rowId: 'news'
            },
            {
                title: '📊 Bot Statistics',
                description: 'View news count, media saved & uptime',
                rowId: 'stats'
            },
            {
                title: '⚙️ Settings Panel',
                description: 'View all bot settings (Owner only)',
                rowId: 'settings'
            },
            {
                title: '📋 Full Command Menu',
                description: 'View all available commands',
                rowId: 'menu'
            },
            {
                title: '💾 Save Media',
                description: 'Reply to media with .save to download',
                rowId: 'save'
            },
            {
                title: '👁️ View-Once Saver',
                description: 'Reply to VV with .vv to save',
                rowId: 'vv'
            }
        ]
    });

    // ═══════════════════════════════════════════════
    // 🛡️ ADMIN CONTROLS SECTION
    // ═══════════════════════════════════════════════
    if (admin || owner) {
        sections.push({
            title: '🛡️ Admin Controls',
            rows: [
                {
                    title: '🎵 Voice Replies ON',
                    description: 'Enable Sinhala/English voice replies in DM',
                    rowId: 'voice_on'
                },
                {
                    title: '🎵 Voice Replies OFF',
                    description: 'Disable voice replies',
                    rowId: 'voice_off'
                },
                {
                    title: '🔗 Anti-Link ON',
                    description: 'Auto-delete WhatsApp/Telegram group links',
                    rowId: 'antilink_on'
                },
                {
                    title: '🔗 Anti-Link OFF',
                    description: 'Allow links in group',
                    rowId: 'antilink_off'
                },
                {
                    title: '👋 Welcome Message ON',
                    description: 'Greet new members when they join',
                    rowId: 'welcome_on'
                },
                {
                    title: '👋 Welcome Message OFF',
                    description: 'Disable welcome greeting',
                    rowId: 'welcome_off'
                },
                {
                    title: '🔇 Mute Group (30min)',
                    description: 'Temporarily mute the group',
                    rowId: 'mute'
                },
                {
                    title: '🔊 Unmute Group',
                    description: 'Remove group mute',
                    rowId: 'unmute'
                }
            ]
        });
    }

    // ═══════════════════════════════════════════════
    // 👑 OWNER PANEL SECTION
    // ═══════════════════════════════════════════════
    if (owner) {
        sections.push({
            title: '👑 Owner Panel',
            rows: [
                {
                    title: '🔘 Button Menu ON',
                    description: 'Use interactive button menus',
                    rowId: 'buttons_on'
                },
                {
                    title: '📋 Text Menu ON',
                    description: 'Switch to text-based menu',
                    rowId: 'buttons_off'
                },
                {
                    title: '🖤 Auto Status ON',
                    description: 'Auto view & react to WhatsApp statuses',
                    rowId: 'autostatus_on'
                },
                {
                    title: '🖤 Auto Status OFF',
                    description: 'Disable auto status features',
                    rowId: 'autostatus_off'
                },
                {
                    title: '📝 Auto Bio ON',
                    description: 'Update WhatsApp bio every 30 minutes',
                    rowId: 'autobio_on'
                },
                {
                    title: '📝 Auto Bio OFF',
                    description: 'Disable auto bio updates',
                    rowId: 'autobio_off'
                },
                {
                    title: '🌍 Mode: PUBLIC',
                    description: 'Anyone can use the bot',
                    rowId: 'mode_public'
                },
                {
                    title: '📥 Mode: INBOX',
                    description: 'Bot works in DMs only',
                    rowId: 'mode_inbox'
                },
                {
                    title: '👥 Mode: GROUPS',
                    description: 'Bot works in groups only',
                    rowId: 'mode_groups'
                },
                {
                    title: '🔒 Mode: PRIVATE',
                    description: 'Only owner can use',
                    rowId: 'mode_private'
                }
            ]
        });
    }

    // Send the button menu
    const buttonMessage = {
        text: [
            `💝 *${config.botName}* v${config.version}`,
            `${MODE_EMOJIS[mode]} Mode: ${mode.toUpperCase()}`,
            '',
            `📋 *Select an option below:*`
        ].join('\n'),
        footer: '🦄💝 NewsBot LK | Charuka Mahesh 💝🦄',
        title: '📋 MAIN MENU',
        buttonText: '📋 TAP HERE TO OPEN',
        sections
    };

    try {
        await sock.sendMessage(jid, buttonMessage);
        console.log('✅ Button menu sent');
    } catch (error) {
        console.error('❌ Failed to send button menu:', error.message);
    }
}

// ============================================================
// 🔘 BUTTON RESPONSE HANDLER
// ============================================================

/**
 * 💝 Handle Button Menu Responses
 * Processes user selections from the interactive menu
 * 
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Message object
 * @param {string} jid - Chat JID
 * @param {Object} db - Database instance
 * @param {Object} config - Bot configuration
 */
async function handleButtonResponse(sock, msg, jid, db, config) {
    // Get selected button ID
    const selectedId = msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId;
    if (!selectedId) return;

    console.log(`🔘 Button Selected: "${selectedId}"`);

    // ═══════════════════════════════════════════════
    // BUTTON ACTION HANDLERS
    // ═══════════════════════════════════════════════
    const actions = {
        // 📰 News
        'news': async () => {
            await sock.sendMessage(jid, {
                text: [
                    '📰 *Fetching Latest News...*',
                    '⏳ Please wait while I gather headlines from 10+ sources...',
                    '',
                    beautifulFooter()
                ].join('\n')
            });
            // Trigger news fetch
            const { checkAndShareAllNewNews } = require('../index');
            if (typeof checkAndShareAllNewNews === 'function') {
                await checkAndShareAllNewNews();
            }
        },

        // 📊 Stats
        'stats': async () => {
            const fs = require('fs');
            const path = require('path');
            const settings = await db.all();
            const urlCount = await db.urlsCount();
            const statusCount = fs.readdirSync(path.join(__dirname, '..', 'saved_status')).length;
            const mediaCount = fs.readdirSync(path.join(__dirname, '..', 'saved_media')).length;

            await sock.sendMessage(jid, {
                text: [
                    beautifulHeader('📊 Statistics'),
                    '',
                    sectionDivider('📊 OVERVIEW', '📈'),
                    `  📰 News Shared: *${urlCount}*`,
                    `  📱 Status Saved: *${statusCount}*`,
                    `  💾 Media Saved: *${mediaCount}*`,
                    '',
                    sectionDivider('⚙️ STATUS', '📋'),
                    `  📰 Auto News: ${statusBadge(settings.autoNewsEnabled)}`,
                    `  🖤 Status React: ${statusBadge(settings.autoStatusReact)}`,
                    `  🎵 Voice: ${statusBadge(settings.voiceReplyEnabled)}`,
                    '',
                    beautifulFooter()
                ].join('\n')
            });
        },

        // ⚙️ Settings
        'settings': async () => {
            const settings = await db.all();
            await sock.sendMessage(jid, {
                text: [
                    beautifulHeader('⚙️ Quick Settings'),
                    '',
                    `📰 Auto News: ${statusBadge(settings.autoNewsEnabled)}`,
                    `🖤 Status: ${statusBadge(settings.autoStatusView)}`,
                    `🎵 Voice: ${statusBadge(settings.voiceReplyEnabled)}`,
                    `🔘 Buttons: ${statusBadge(settings.buttonMenuEnabled !== false)}`,
                    `📝 Bio: ${statusBadge(settings.autoBioEnabled)}`,
                    '',
                    `💡 Use *.settings* for full panel`,
                    '',
                    beautifulFooter()
                ].join('\n')
            });
        },

        // 📋 Full Menu
        'menu': async () => {
            const prefix = await db.get('prefix', '.');
            const owner = true; // Will be determined by caller
            // This will be called from the main handler with proper permissions
        },

        // 💾 Save
        'save': async () => {
            await sock.sendMessage(jid, {
                text: [
                    '💡 *How to Save Media*',
                    '',
                    '📌 Reply to any media message with:',
                    `   *${await db.get('prefix', '.')}save*`,
                    '',
                    '🖼️ Images | 🎥 Videos | 🎵 Audio | 🎨 Stickers',
                    '',
                    beautifulFooter()
                ].join('\n')
            });
        },

        // 👁️ View-Once
        'vv': async () => {
            await sock.sendMessage(jid, {
                text: [
                    '💡 *How to Save View-Once*',
                    '',
                    '📌 Reply to a view-once message with:',
                    `   *${await db.get('prefix', '.')}vv*`,
                    '',
                    '👁️ The media will be saved securely',
                    '',
                    beautifulFooter()
                ].join('\n')
            });
        },

        // 🎵 Voice Toggles
        'voice_on': async () => {
            await db.set('voiceReplyEnabled', true);
            await sock.sendMessage(jid, {
                text: `🎵 *Voice Replies: ${statusBadge(true)}*\n\n${beautifulFooter()}`
            });
        },
        'voice_off': async () => {
            await db.set('voiceReplyEnabled', false);
            await sock.sendMessage(jid, {
                text: `🎵 *Voice Replies: ${statusBadge(false)}*\n\n${beautifulFooter()}`
            });
        },

        // 🔗 AntiLink Toggles
        'antilink_on': async () => {
            await db.set('antiLinkEnabled', true);
            await sock.sendMessage(jid, {
                text: `🔗 *Anti-Link Protection: ${statusBadge(true)}*\n\n${beautifulFooter()}`
            });
        },
        'antilink_off': async () => {
            await db.set('antiLinkEnabled', false);
            await sock.sendMessage(jid, {
                text: `🔗 *Anti-Link Protection: ${statusBadge(false)}*\n\n${beautifulFooter()}`
            });
        },

        // 👋 Welcome Toggles
        'welcome_on': async () => {
            await db.set('welcomeEnabled', true);
            await sock.sendMessage(jid, {
                text: `👋 *Welcome Messages: ${statusBadge(true)}*\n\n${beautifulFooter()}`
            });
        },
        'welcome_off': async () => {
            await db.set('welcomeEnabled', false);
            await sock.sendMessage(jid, {
                text: `👋 *Welcome Messages: ${statusBadge(false)}*\n\n${beautifulFooter()}`
            });
        },

        // 🔇 Mute Controls
        'mute': async () => {
            await db.groupSet(jid, 'isMuted', true);
            await sock.sendMessage(jid, {
                text: `🔇 *Group Muted for 30 Minutes*\n\n${beautifulFooter()}`
            });
            setTimeout(() => db.groupSet(jid, 'isMuted', false), 30 * 60 * 1000);
        },
        'unmute': async () => {
            await db.groupSet(jid, 'isMuted', false);
            await sock.sendMessage(jid, {
                text: `🔊 *Group Unmuted!*\n\n${beautifulFooter()}`
            });
        },

        // 🔘 Button Menu Toggles
        'buttons_on': async () => {
            await db.set('buttonMenuEnabled', true);
            await sock.sendMessage(jid, {
                text: `🔘 *Button Menu: ${statusBadge(true)}*\n💡 Use *.menu* to see it!\n\n${beautifulFooter()}`
            });
        },
        'buttons_off': async () => {
            await db.set('buttonMenuEnabled', false);
            await sock.sendMessage(jid, {
                text: `📋 *Text Menu: ${statusBadge(true)}*\n💡 Use *.menu* to see it!\n\n${beautifulFooter()}`
            });
        },

        // 🖤 Auto Status Toggles
        'autostatus_on': async () => {
            await db.set('autoStatusView', true);
            await db.set('autoStatusReact', true);
            await sock.sendMessage(jid, {
                text: `🖤 *Auto Status: ${statusBadge(true)}*\n👁️ View + 💬 React enabled\n\n${beautifulFooter()}`
            });
        },
        'autostatus_off': async () => {
            await db.set('autoStatusView', false);
            await db.set('autoStatusReact', false);
            await sock.sendMessage(jid, {
                text: `🖤 *Auto Status: ${statusBadge(false)}*\n\n${beautifulFooter()}`
            });
        },

        // 📝 Auto Bio Toggles
        'autobio_on': async () => {
            await db.set('autoBioEnabled', true);
            await sock.sendMessage(jid, {
                text: `📝 *Auto Bio: ${statusBadge(true)}*\n🔄 Updates every 30 minutes\n\n${beautifulFooter()}`
            });
        },
        'autobio_off': async () => {
            await db.set('autoBioEnabled', false);
            await sock.sendMessage(jid, {
                text: `📝 *Auto Bio: ${statusBadge(false)}*\n\n${beautifulFooter()}`
            });
        },

        // 🌍 Mode Switches
        'mode_public': async () => {
            await db.set('botMode', 'public');
            await sock.sendMessage(jid, {
                text: `🌍 *Mode: PUBLIC*\n👥 Everyone can use the bot\n\n${beautifulFooter()}`
            });
        },
        'mode_inbox': async () => {
            await db.set('botMode', 'inbox');
            await sock.sendMessage(jid, {
                text: `📥 *Mode: INBOX*\n💬 Bot works in DMs only\n\n${beautifulFooter()}`
            });
        },
        'mode_groups': async () => {
            await db.set('botMode', 'groups');
            await sock.sendMessage(jid, {
                text: `👥 *Mode: GROUPS*\n📢 Bot works in groups only\n\n${beautifulFooter()}`
            });
        },
        'mode_private': async () => {
            await db.set('botMode', 'private');
            await sock.sendMessage(jid, {
                text: `🔒 *Mode: PRIVATE*\n👑 Only owner can use\n\n${beautifulFooter()}`
            });
        }
    };

    // Execute the selected action
    if (actions[selectedId]) {
        try {
            await actions[selectedId]();
        } catch (error) {
            console.error(`❌ Button action error (${selectedId}):`, error.message);
            await sock.sendMessage(jid, {
                text: `❌ *Action failed!*\n\n${beautifulFooter()}`
            });
        }
    }
}

// ============================================================
// 📋 BEAUTIFUL TEXT MENU
// ============================================================

/**
 * 💝 Send Beautiful Main Menu
 * Full-featured text menu with sections
 * 
 * @param {Object} sock - WhatsApp socket
 * @param {string} jid - Chat JID
 * @param {Object} db - Database instance
 * @param {Object} config - Bot configuration
 * @param {boolean} owner - Is user owner?
 * @param {boolean} admin - Is user admin?
 * @param {boolean} isGroup - Is chat a group?
 * @param {string} prefix - Command prefix
 */
async function sendMainMenu(sock, jid, db, config, owner, admin, isGroup, prefix) {
    const mode = await db.get('botMode', 'public');

    const menuLines = [
        // ═══════════════════════════════════════
        // HEADER
        // ═══════════════════════════════════════
        '╭' + '─'.repeat(40) + '╮',
        '┃       💝 *NewsBot LK* 💝       ┃',
        '┃   🦄 ✨ *Sri Lanka\'s #1* ✨ 🦄   ┃',
        '┃     *WhatsApp News Bot*        ┃',
        '┃     ' + MODE_EMOJIS[mode] + ' Mode: ' + mode.toUpperCase() + '              ┃',
        '╰' + '─'.repeat(40) + '╯',
        '',

        // ═══════════════════════════════════════
        // 📰 NEWS CENTER
        // ═══════════════════════════════════════
        sectionDivider('📰 NEWS CENTER', '📡'),
        '  ✦ ' + prefix + 'news    ─ Fetch Latest News',
        '  ✦ ' + prefix + 'stats   ─ Bot Statistics',
        '',

        // ═══════════════════════════════════════
        // 💾 MEDIA STUDIO
        // ═══════════════════════════════════════
        sectionDivider('💾 MEDIA STUDIO', '📦'),
        '  ✦ ' + prefix + 'save    ─ Save Media Files',
        '  ✦ ' + prefix + 'vv      ─ Save View-Once',
        '  ✦ ' + prefix + 'status  ─ Status Info',
        '',

        // ═══════════════════════════════════════
        // 👥 GROUP TOOLS
        // ═══════════════════════════════════════
        sectionDivider('👥 GROUP TOOLS', '👑'),
        '  ✦ ' + prefix + 'admins    ─ List Admins',
        '  ✦ ' + prefix + 'groupinfo ─ Group Details',
        '  ✦ ' + prefix + 'tagall    ─ Mention All',
        '  ✦ ' + prefix + 'poll      ─ Create Poll',
        '  ✦ ' + prefix + 'afk       ─ Set AFK Status',
        ''
    ];

    // ═══════════════════════════════════════
    // 🛡️ ADMIN PANEL
    // ═══════════════════════════════════════
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

    // ═══════════════════════════════════════
    // 👑 OWNER SUITE
    // ═══════════════════════════════════════
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

    // ═══════════════════════════════════════
    // 🎵 VOICE COMMANDS
    // ═══════════════════════════════════════
    menuLines.push(
        sectionDivider('🎵 VOICE COMMANDS (DM)', '🎤'),
        '  gm ✦ gn ✦ hi ✦ ily ✦ bye',
        '  sad ✦ happy ✦ cry ✦ love',
        '  adarei ✦ kohomada ✦ pakaya',
        '  ...150+ Sinhala & English triggers!',
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

    try {
        await sock.sendMessage(jid, {
            image: { url: config.botLogo },
            caption: caption,
            mimetype: 'image/png'
        });
        console.log('✅ Beautiful menu sent');
    } catch (error) {
        console.error('❌ Failed to send menu:', error.message);
        // Fallback: text only
        await sock.sendMessage(jid, { text: caption });
    }
}

// ============================================================
// ⚙️ BEAUTIFUL SETTINGS MENU
// ============================================================

/**
 * 💝 Send Beautiful Settings Panel
 * Full settings display with toggle hints
 * 
 * @param {Object} sock - WhatsApp socket
 * @param {string} jid - Chat JID
 * @param {Object} db - Database instance
 * @param {boolean} isOwner - Is user owner?
 * @param {Object} config - Bot configuration
 */
async function sendSettingsMenu(sock, jid, db, isOwner, config) {
    // Owner check
    if (!isOwner) {
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

    // Get all settings
    const settings = await db.all();
    const bans = await db.banAll();
    const currentMode = settings.botMode || 'public';

    const settingsLines = [
        // Header
        '╭' + '─'.repeat(38) + '╮',
        '┃         ⚙️ *Bot Settings*         ┃',
        '┃         💝 NewsBot LK 💝         ┃',
        '╰' + '─'.repeat(38) + '╯',
        '',

        // 📰 News
        sectionDivider('📰 NEWS', '📡'),
        '  ▸ Auto News : ' + statusBadge(settings.autoNewsEnabled) + '  → .autonews on/off',
        '',

        // 🖤 Status
        sectionDivider('🖤 STATUS', '📱'),
        '  ▸ Auto View : ' + statusBadge(settings.autoStatusView) + '  → .autostatus on/off',
        '  ▸ Auto React: ' + statusBadge(settings.autoStatusReact),
        '',

        // 🔒 Security
        sectionDivider('🔒 SECURITY', '🛡️'),
        '  ▸ Anti-Link : ' + statusBadge(settings.antiLinkEnabled) + '  → .antilink on/off',
        '  ▸ Anti VV   : ' + statusBadge(settings.antiViewOnce) + '  → .antiview on/off',
        '',

        // 🎵 Voice
        sectionDivider('🎵 VOICE', '🎤'),
        '  ▸ Voice Replies: ' + statusBadge(settings.voiceReplyEnabled) + '  → .voice on/off',
        '',

        // 🔘 Buttons
        sectionDivider('🔘 DISPLAY', '✨'),
        '  ▸ Button Menu: ' + statusBadge(settings.buttonMenuEnabled !== false) + '  → .buttons on/off',
        '  ▸ Auto Bio   : ' + statusBadge(settings.autoBioEnabled) + '  → .autobio on/off',
        '',

        // 👥 Group
        sectionDivider('👥 GROUP', '👑'),
        '  ▸ Welcome : ' + statusBadge(settings.welcomeEnabled) + '  → .welcome on/off',
        '  ▸ Goodbye : ' + statusBadge(settings.goodbyeEnabled) + '  → .goodbye on/off',
        '',

        // 🔧 System
        sectionDivider('🔧 SYSTEM', '⚙️'),
        '  ▸ Prefix : "' + (settings.prefix || '.') + '"  → .setprefix',
        '  ▸ Mode   : ' + MODE_EMOJIS[currentMode] + ' ' + currentMode.toUpperCase() + '  → .mode',
        '  ▸ Banned : ' + bans.length + ' users',
        '  ▸ Version: v' + config.version,
        '',

        // Footer
        '━'.repeat(38),
        '🌐 ' + config.portfolio,
        '👨‍💻 ' + config.developer,
        '',
        beautifulFooter()
    ];

    const caption = settingsLines.join('\n');

    try {
        await sock.sendMessage(jid, {
            image: { url: config.botLogo },
            caption: caption,
            mimetype: 'image/png'
        });
        console.log('✅ Settings menu sent');
    } catch (error) {
        console.error('❌ Failed to send settings:', error.message);
        await sock.sendMessage(jid, { text: caption });
    }
}

// ============================================================
// 📤 EXPORTS
// ============================================================
module.exports = {
    handleButtonMenu,
    handleButtonResponse,
    sendMainMenu,
    sendSettingsMenu
};
