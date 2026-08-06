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
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ============================================================
// 🎨 MENU CONSTANTS
// ============================================================
const MODE_EMOJIS = {
    private: '🔒',
    inbox: '📥',
    groups: '👥',
    public: '🌍'
};

// ============================================================
// 🔘 INTERACTIVE BUTTON MENU (Working WhatsApp Format)
// ============================================================

/**
 * 💝 Send Interactive Button Menu
 * Uses WhatsApp Interactive Buttons (new format)
 */
async function handleButtonMenu(sock, jid, db, config, owner, admin, group, prefix) {
    try {
        const mode = await db.get('botMode', 'public');
        const voiceEnabled = await db.get('voiceReplyEnabled', true);
        const autoNewsEnabled = await db.get('autoNewsEnabled', true);
        const buttonMenuEnabled = await db.get('buttonMenuEnabled', true);

        // If buttons are disabled, send text menu
        if (!buttonMenuEnabled) {
            await sendMainMenu(sock, jid, db, config, owner, admin, group, prefix);
            return;
        }

        const bodyText = [
            `💝 *${config.botName}* v${config.version}`,
            `${MODE_EMOJIS[mode]} Mode: *${mode.toUpperCase()}*`,
            '',
            '📰 Auto News: ' + (autoNewsEnabled ? '✅' : '❌'),
            '🎵 Voice: ' + (voiceEnabled ? '✅' : '❌'),
            '',
            '👇 *Select an option:*'
        ].join('\n');

        // ═══════════════════════════════════════
        // METHOD 1: Interactive Buttons (Most Reliable)
        // ═══════════════════════════════════════
        try {
            const sections = [];
            
            // Main Section
            const mainRows = [
                { id: 'news', title: '📰 Latest News', description: 'Fetch today\'s headlines' },
                { id: 'stats', title: '📊 Statistics', description: 'Bot usage statistics' },
                { id: 'menu', title: '📋 Full Menu', description: 'View all commands' }
            ];

            // Admin Section
            if (admin || owner) {
                mainRows.push({ id: 'settings', title: '⚙️ Settings', description: 'Bot configuration' });
            }

            sections.push({
                title: '📌 Main Menu',
                rows: mainRows
            });

            // Additional Section for Admin
            if (admin || owner) {
                sections.push({
                    title: '🛡️ Admin Panel',
                    rows: [
                        { id: 'admin_panel', title: '⚙️ Admin Tools', description: 'Manage group and bot' },
                        { id: 'mute', title: '🔇 Mute Group', description: 'Toggle mute' },
                        { id: 'warn', title: '⚠️ Warn User', description: 'Warn a member' }
                    ]
                });
            }

            // Owner Section
            if (owner) {
                sections.push({
                    title: '👑 Owner Panel',
                    rows: [
                        { id: 'owner_settings', title: '💎 Owner Settings', description: 'Full bot control' },
                        { id: 'broadcast', title: '📢 Broadcast', description: 'Send mass message' },
                        { id: 'ban', title: '🚫 Ban User', description: 'Ban a user' }
                    ]
                });
            }

            await sock.sendMessage(jid, {
                text: bodyText,
                footer: '🦄💝 NewsBot LK | Charuka Mahesh 💝🦄',
                interactiveButtons: [
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify({
                            title: '📋 Menu',
                            sections: sections
                        })
                    }
                ]
            });
            console.log('✅ Interactive menu sent successfully');
            return;
        } catch (interactiveError) {
            console.log('⚠️ Interactive buttons failed:', interactiveError.message);
        }

        // ═══════════════════════════════════════
        // METHOD 2: List Message (Fallback)
        // ═══════════════════════════════════════
        try {
            const sections = [
                {
                    title: '📰 News & Info',
                    rows: [
                        { rowId: 'news', title: '📰 Latest News', description: 'Get today\'s headlines' },
                        { rowId: 'stats', title: '📊 Statistics', description: 'View bot stats' }
                    ]
                },
                {
                    title: '📋 Commands',
                    rows: [
                        { rowId: 'menu', title: '📋 Full Menu', description: 'All available commands' }
                    ]
                }
            ];

            if (admin || owner) {
                sections.push({
                    title: '⚙️ Admin',
                    rows: [
                        { rowId: 'settings', title: '⚙️ Settings', description: 'Bot configuration' }
                    ]
                });
            }

            await sock.sendMessage(jid, {
                text: bodyText,
                footer: '🦄💝 NewsBot LK | Charuka Mahesh 💝🦄',
                list: {
                    buttonText: '📋 Open Menu',
                    sections: sections
                }
            });
            console.log('✅ List menu sent successfully');
            return;
        } catch (listError) {
            console.log('⚠️ List message failed:', listError.message);
        }

        // ═══════════════════════════════════════
        // METHOD 3: Template Buttons (Legacy Fallback)
        // ═══════════════════════════════════════
        try {
            const templateButtons = [
                { index: 0, urlButton: { displayText: '📰 News', url: 'https://example.com' } },
                { index: 1, callButton: { displayText: '📊 Stats', phoneNumber: config.ownerNumber } }
            ];

            await sock.sendMessage(jid, {
                text: bodyText,
                footer: '🦄💝 NewsBot LK | Charuka Mahesh 💝🦄',
                templateButtons: templateButtons
            });
            console.log('✅ Template buttons sent');
            return;
        } catch (templateError) {
            console.log('⚠️ Template buttons failed:', templateError.message);
        }

        // ═══════════════════════════════════════
        // METHOD 4: Text Menu (Final Fallback)
        // ═══════════════════════════════════════
        console.log('⚠️ All button methods failed, sending text menu...');
        await sendMainMenu(sock, jid, db, config, owner, admin, group, prefix);

    } catch (error) {
        console.error('❌ handleButtonMenu error:', error.message);
        await sendMainMenu(sock, jid, db, config, owner, admin, group, prefix);
    }
}

// ============================================================
// 🔘 BUTTON RESPONSE HANDLER
// ============================================================

/**
 * 💝 Handle Button Menu Responses
 */
async function handleButtonResponse(sock, msg, jid, db, config, callbacks = {}) {
    try {
        let selectedId = null;
        let selectedTitle = null;

        // Check for Interactive Button response (new format)
        if (msg.message?.interactiveResponseMessage?.singleSelectReply) {
            selectedId = msg.message.interactiveResponseMessage.singleSelectReply.selectedRowId;
            selectedTitle = msg.message.interactiveResponseMessage.singleSelectReply.title;
        }
        // Check for List message response
        else if (msg.message?.listResponseMessage?.singleSelectReply) {
            selectedId = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
            selectedTitle = msg.message.listResponseMessage.singleSelectReply.title;
        }
        // Check for legacy button response
        else if (msg.message?.buttonsResponseMessage?.selectedButtonId) {
            selectedId = msg.message.buttonsResponseMessage.selectedButtonId;
        }

        if (!selectedId) return;

        console.log(`🔘 Selection: "${selectedId}" (${selectedTitle || 'no title'})`);

        // Handle the selection
        await handleSelection(sock, selectedId, jid, db, config, callbacks);

    } catch (error) {
        console.error('❌ handleButtonResponse error:', error.message);
    }
}

/**
 * 💝 Handle Selection Actions
 */
async function handleSelection(sock, id, jid, db, config, callbacks) {
    try {
        const actions = {
            // News Actions
            'news': async () => {
                if (typeof callbacks.news === 'function') {
                    await callbacks.news(jid, callbacks.isGroup);
                } else {
                    await sock.sendMessage(jid, { 
                        text: '📰 Use *.news* to fetch latest news!' 
                    });
                }
            },

            // Stats Action
            'stats': async () => {
                const settings = await db.all();
                const urlCount = await db.urlsCount() || 0;
                const statusFolder = path.join(__dirname, '..', 'saved_status');
                const mediaFolder = path.join(__dirname, '..', 'saved_media');
                const statusCount = fs.existsSync(statusFolder) ? fs.readdirSync(statusFolder).length : 0;
                const mediaCount = fs.existsSync(mediaFolder) ? fs.readdirSync(mediaFolder).length : 0;

                await sock.sendMessage(jid, {
                    text: [
                        '╔' + '═'.repeat(30) + '╗',
                        '║     📊 *STATISTICS*     ║',
                        '╚' + '═'.repeat(30) + '╝',
                        '',
                        '📰 News Shared: *' + urlCount + '*',
                        '📱 Status Saved: *' + statusCount + '*',
                        '💾 Media Saved: *' + mediaCount + '*',
                        '',
                        '📰 Auto News: ' + (settings.autoNewsEnabled ? '✅ ON' : '❌ OFF'),
                        '🎵 Voice: ' + (settings.voiceReplyEnabled ? '✅ ON' : '❌ OFF'),
                        '🔘 Buttons: ' + (settings.buttonMenuEnabled !== false ? '✅ ON' : '❌ OFF'),
                        '',
                        beautifulFooter()
                    ].join('\n')
                });
            },

            // Menu Action
            'menu': async () => {
                const prefix = await db.get('prefix', '.');
                if (typeof callbacks.menu === 'function') {
                    await callbacks.menu(jid, callbacks.isOwner, callbacks.isAdmin, callbacks.isGroup);
                } else {
                    await sendMainMenu(sock, jid, db, config, callbacks.isOwner, callbacks.isAdmin, callbacks.isGroup, prefix);
                }
            },

            // Settings Actions
            'settings': async () => {
                await sendSettingsMenu(sock, jid, db, callbacks.isOwner, config);
            },
            'owner_settings': async () => {
                await sendSettingsMenu(sock, jid, db, true, config);
            },

            // Admin Actions
            'admin_panel': async () => {
                const prefix = await db.get('prefix', '.');
                await sock.sendMessage(jid, {
                    text: [
                        '╔' + '═'.repeat(30) + '╗',
                        '║   🛡️ *ADMIN PANEL*   ║',
                        '╚' + '═'.repeat(30) + '╝',
                        '',
                        '✦ ' + prefix + 'mute/unmute    ─ Toggle Mute',
                        '✦ ' + prefix + 'warn @user     ─ Warn Member',
                        '✦ ' + prefix + 'kick @user     ─ Remove Member',
                        '✦ ' + prefix + 'voice on/off   ─ Toggle Voice',
                        '✦ ' + prefix + 'antilink on/off ─ Link Protection',
                        '✦ ' + prefix + 'buttons on/off  ─ Button Menu',
                        '',
                        beautifulFooter()
                    ].join('\n')
                });
            },

            'mute': async () => {
                if (!callbacks.isAdmin && !callbacks.isOwner) {
                    await sock.sendMessage(jid, { text: '❌ *Admin only!*' });
                    return;
                }
                await sock.sendMessage(jid, { 
                    text: '🔇 Use *.mute* or *.unmute* to toggle group mute' 
                });
            },

            'warn': async () => {
                if (!callbacks.isAdmin && !callbacks.isOwner) {
                    await sock.sendMessage(jid, { text: '❌ *Admin only!*' });
                    return;
                }
                await sock.sendMessage(jid, { 
                    text: '⚠️ Use *.warn @user* to warn a member' 
                });
            },

            // Owner Actions
            'broadcast': async () => {
                if (!callbacks.isOwner) {
                    await sock.sendMessage(jid, { text: '❌ *Owner only!*' });
                    return;
                }
                await sock.sendMessage(jid, { 
                    text: '📢 Use *.broadcast [message]* to send mass message' 
                });
            },

            'ban': async () => {
                if (!callbacks.isOwner) {
                    await sock.sendMessage(jid, { text: '❌ *Owner only!*' });
                    return;
                }
                await sock.sendMessage(jid, { 
                    text: '🚫 Use *.ban @user* to ban a user' 
                });
            }
        };

        if (actions[id]) {
            await actions[id]();
        } else {
            console.log(`⚠️ Unknown selection ID: "${id}"`);
            await sock.sendMessage(jid, { 
                text: '❌ *Unknown option!* Please use the menu buttons.' 
            });
        }

    } catch (error) {
        console.error('❌ handleSelection error:', error.message);
        await sock.sendMessage(jid, { 
            text: '❌ *Action failed!* Please try again.' 
        });
    }
}

// ============================================================
// 📋 BEAUTIFUL TEXT MENU (Fallback)
// ============================================================

async function sendMainMenu(sock, jid, db, config, owner, admin, isGroup, prefix) {
    try {
        const mode = await db.get('botMode', 'public');

        const menuLines = [
            '╭' + '─'.repeat(40) + '╮',
            '┃       💝 *NewsBot LK* 💝       ┃',
            '┃   🦄 ✨ *Sri Lanka\'s #1* ✨ 🦄   ┃',
            '┃     *WhatsApp News Bot*        ┃',
            '┃     ' + MODE_EMOJIS[mode] + ' Mode: ' + mode.toUpperCase() + '              ┃',
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
            '',
        ];

        if (admin || owner) {
            menuLines.push(
                sectionDivider('🛡️ ADMIN PANEL', '⚔️'),
                '  ✦ ' + prefix + 'mute/unmute    ─ Toggle Mute',
                '  ✦ ' + prefix + 'warn @user     ─ Warn Member',
                '  ✦ ' + prefix + 'kick @user     ─ Remove Member',
                '  ✦ ' + prefix + 'voice on/off   ─ Toggle Voice',
                '  ✦ ' + prefix + 'antilink on/off ─ Link Protection',
                '  ✦ ' + prefix + 'buttons on/off  ─ Button Menu',
                '',
            );
        }

        if (owner) {
            menuLines.push(
                sectionDivider('👑 OWNER SUITE', '💎'),
                '  ✦ ' + prefix + 'settings        ─ All Settings',
                '  ✦ ' + prefix + 'mode public     ─ Bot Mode',
                '  ✦ ' + prefix + 'autostatus on/off ─ Auto Status',
                '  ✦ ' + prefix + 'autonews on/off  ─ Auto News',
                '  ✦ ' + prefix + 'broadcast msg   ─ Mass Message',
                '  ✦ ' + prefix + 'ban @user       ─ Ban User',
                '',
            );
        }

        menuLines.push(
            sectionDivider('🎵 VOICE COMMANDS (DM)', '🎤'),
            '  gm ✦ gn ✦ hi ✦ ily ✦ bye',
            '  sad ✦ happy ✦ cry ✦ love',
            '  adarei ✦ kohomada ✦ pakaya',
            '  ...150+ Sinhala & English!',
            '',
            '━'.repeat(40),
            '👨‍💻 ' + config.developer,
            '📦 Version: ' + config.version,
            '🔧 Prefix: "' + prefix + '"',
            '',
            beautifulFooter()
        );

        const caption = menuLines.join('\n');

        // Try sending with image
        try {
            const imgRes = await axios.get(config.botLogo, { 
                responseType: 'arraybuffer', 
                timeout: 10000 
            });
            await sock.sendMessage(jid, {
                image: Buffer.from(imgRes.data),
                caption: caption,
                mimetype: 'image/png'
            });
            console.log('✅ Menu sent with image');
        } catch (e) {
            await sock.sendMessage(jid, { text: caption });
            console.log('✅ Menu sent (text only)');
        }

    } catch (error) {
        console.error('❌ sendMainMenu error:', error.message);
        await sock.sendMessage(jid, { 
            text: '❌ Failed to send menu. Please try again.' 
        });
    }
}

// ============================================================
// ⚙️ BEAUTIFUL SETTINGS MENU
// ============================================================

async function sendSettingsMenu(sock, jid, db, isOwner, config) {
    try {
        if (!isOwner) {
            await sock.sendMessage(jid, {
                text: '╭' + '─'.repeat(30) + '╮\n┃  ❌ *Owner Only!*  ┃\n╰' + '─'.repeat(30) + '╯\n\n' + beautifulFooter()
            });
            return;
        }

        const settings = await db.all();
        const bans = await db.banAll() || [];
        const currentMode = settings.botMode || 'public';
        const prefix = settings.prefix || '.';

        const settingsLines = [
            '╭' + '─'.repeat(38) + '╮',
            '┃         ⚙️ *Bot Settings*         ┃',
            '┃         💝 NewsBot LK 💝         ┃',
            '╰' + '─'.repeat(38) + '╯',
            '',
            sectionDivider('📰 NEWS', '📡'),
            '  ▸ Auto News : ' + statusBadge(settings.autoNewsEnabled) + '  → .autonews on/off',
            '',
            sectionDivider('🖤 STATUS', '📱'),
            '  ▸ Auto View : ' + statusBadge(settings.autoStatusView) + '  → .autostatus on/off',
            '  ▸ Auto React: ' + statusBadge(settings.autoStatusReact),
            '',
            sectionDivider('🔒 SECURITY', '🛡️'),
            '  ▸ Anti-Link : ' + statusBadge(settings.antiLinkEnabled) + '  → .antilink on/off',
            '',
            sectionDivider('🎵 VOICE', '🎤'),
            '  ▸ Voice Replies: ' + statusBadge(settings.voiceReplyEnabled) + '  → .voice on/off',
            '',
            sectionDivider('🔘 DISPLAY', '✨'),
            '  ▸ Button Menu: ' + statusBadge(settings.buttonMenuEnabled !== false) + '  → .buttons on/off',
            '  ▸ Auto Bio   : ' + statusBadge(settings.autoBioEnabled) + '  → .autobio on/off',
            '',
            sectionDivider('👥 GROUP', '👑'),
            '  ▸ Welcome : ' + statusBadge(settings.welcomeEnabled) + '  → .welcome on/off',
            '  ▸ Goodbye : ' + statusBadge(settings.goodbyeEnabled) + '  → .goodbye on/off',
            '',
            sectionDivider('🔧 SYSTEM', '⚙️'),
            '  ▸ Prefix : "' + prefix + '"  → .setprefix',
            '  ▸ Mode   : ' + MODE_EMOJIS[currentMode] + ' ' + currentMode.toUpperCase() + '  → .mode',
            '  ▸ Banned : ' + (Array.isArray(bans) ? bans.length : 0) + ' users',
            '  ▸ Version: v' + config.version,
            '',
            '━'.repeat(38),
            '👨‍💻 ' + config.developer,
            '',
            beautifulFooter()
        ];

        const caption = settingsLines.join('\n');

        // Try sending with image
        try {
            const imgRes = await axios.get(config.botLogo, { 
                responseType: 'arraybuffer', 
                timeout: 10000 
            });
            await sock.sendMessage(jid, {
                image: Buffer.from(imgRes.data),
                caption: caption,
                mimetype: 'image/png'
            });
            console.log('✅ Settings sent with image');
        } catch (e) {
            await sock.sendMessage(jid, { text: caption });
            console.log('✅ Settings sent (text only)');
        }

    } catch (error) {
        console.error('❌ sendSettingsMenu error:', error.message);
        await sock.sendMessage(jid, { 
            text: '❌ Failed to load settings. Please try again.' 
        });
    }
}

// ============================================================
// 📤 EXPORTS
// ============================================================
module.exports = {
    handleButtonMenu,
    handleButtonResponse,
    sendMainMenu,
    sendSettingsMenu,
    handleSelection
};
