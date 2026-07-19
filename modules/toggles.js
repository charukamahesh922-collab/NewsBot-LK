// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🔘 Toggle Commands 🔘                       ║
// ║         Quick ON/OFF switches for bot features              ║
// ╚══════════════════════════════════════════════════════════════╝

const { beautifulFooter, statusBadge } = require('./helpers');

// ============================================================
// 🎨 TOGGLE CONFIGURATIONS
// ============================================================

/**
 * All available toggle commands
 * Each toggle has:
 * - key: Database setting key
 * - val: Value to set (default: true)
 * - emoji: Display emoji
 * - name: Display name
 * - onMessage: Custom ON message (optional)
 * - offMessage: Custom OFF message (optional)
 */
const TOGGLE_COMMANDS = [
    // ═══════════════════════════════════════════════
    // 🔗 ANTI-LINK PROTECTION
    // ═══════════════════════════════════════════════
    {
        command: 'antilink on',
        key: 'antiLinkEnabled',
        value: true,
        emoji: '🔗',
        name: 'Anti-Link Protection',
        description: 'Auto-deletes WhatsApp/Telegram/Discord links'
    },
    {
        command: 'antilink off',
        key: 'antiLinkEnabled',
        value: false,
        emoji: '🔗',
        name: 'Anti-Link Protection'
    },

    // ═══════════════════════════════════════════════
    // 🚫 ANTI VIEW-ONCE
    // ═══════════════════════════════════════════════
    {
        command: 'antiview on',
        key: 'antiViewOnce',
        value: true,
        emoji: '🚫',
        name: 'Anti View-Once',
        description: 'Skips view-once statuses for privacy'
    },
    {
        command: 'antiview off',
        key: 'antiViewOnce',
        value: false,
        emoji: '👁️',
        name: 'Anti View-Once'
    },

    // ═══════════════════════════════════════════════
    // 👋 WELCOME MESSAGES
    // ═══════════════════════════════════════════════
    {
        command: 'welcome on',
        key: 'welcomeEnabled',
        value: true,
        emoji: '👋',
        name: 'Welcome Messages',
        description: 'Greets new members when they join'
    },
    {
        command: 'welcome off',
        key: 'welcomeEnabled',
        value: false,
        emoji: '👋',
        name: 'Welcome Messages'
    },

    // ═══════════════════════════════════════════════
    // 👋 GOODBYE MESSAGES
    // ═══════════════════════════════════════════════
    {
        command: 'goodbye on',
        key: 'goodbyeEnabled',
        value: true,
        emoji: '😢',
        name: 'Goodbye Messages',
        description: 'Sends message when members leave'
    },
    {
        command: 'goodbye off',
        key: 'goodbyeEnabled',
        value: false,
        emoji: '😢',
        name: 'Goodbye Messages'
    },

    // ═══════════════════════════════════════════════
    // 📝 AUTO BIO
    // ═══════════════════════════════════════════════
    {
        command: 'autobio on',
        key: 'autoBioEnabled',
        value: true,
        emoji: '📝',
        name: 'Auto Bio',
        description: 'Updates WhatsApp bio every 30 minutes'
    },
    {
        command: 'autobio off',
        key: 'autoBioEnabled',
        value: false,
        emoji: '📝',
        name: 'Auto Bio'
    },

    // ═══════════════════════════════════════════════
    // 🔘 BUTTON MENU
    // ═══════════════════════════════════════════════
    {
        command: 'buttons on',
        key: 'buttonMenuEnabled',
        value: true,
        emoji: '🔘',
        name: 'Button Menu',
        description: 'Uses interactive WhatsApp buttons'
    },
    {
        command: 'buttons off',
        key: 'buttonMenuEnabled',
        value: false,
        emoji: '📋',
        name: 'Text Menu',
        description: 'Uses traditional text menu'
    },

    // ═══════════════════════════════════════════════
    // 🎵 VOICE REPLIES
    // ═══════════════════════════════════════════════
    {
        command: 'voice on',
        key: 'voiceReplyEnabled',
        value: true,
        emoji: '🎵',
        name: 'Voice Replies',
        description: 'Sends voice clips for trigger words'
    },
    {
        command: 'voice off',
        key: 'voiceReplyEnabled',
        value: false,
        emoji: '🔇',
        name: 'Voice Replies'
    },

    // ═══════════════════════════════════════════════
    // 📰 AUTO NEWS
    // ═══════════════════════════════════════════════
    {
        command: 'autonews on',
        key: 'autoNewsEnabled',
        value: true,
        emoji: '📰',
        name: 'Auto News',
        description: 'Fetches news automatically',
        ownerOnly: true
    },
    {
        command: 'autonews off',
        key: 'autoNewsEnabled',
        value: false,
        emoji: '📰',
        name: 'Auto News',
        ownerOnly: true
    },

    // ═══════════════════════════════════════════════
    // 🖤 AUTO STATUS
    // ═══════════════════════════════════════════════
    {
        command: 'autostatus on',
        key: 'autoStatusView',
        value: true,
        emoji: '🖤',
        name: 'Auto Status',
        description: 'Auto views & reacts to statuses',
        ownerOnly: true,
        extraSet: { autoStatusReact: true }
    },
    {
        command: 'autostatus off',
        key: 'autoStatusView',
        value: false,
        emoji: '🖤',
        name: 'Auto Status',
        ownerOnly: true,
        extraSet: { autoStatusReact: false }
    }
];

// ============================================================
// 🔘 TOGGLE HANDLER
// ============================================================

/**
 * 💝 Handle Toggle Commands
 * Processes ON/OFF commands for bot features
 * 
 * @param {Object} sock - WhatsApp socket
 * @param {string} jid - Chat JID
 * @param {Object} db - Database instance
 * @param {string} lower - Lowercase message text
 * @param {string} prefix - Command prefix
 * @param {boolean} canToggle - Does user have permission?
 * @param {boolean} isOwner - Is user the bot owner?
 * @returns {boolean} - True if a toggle was processed
 */
async function handleToggles(sock, jid, db, lower, prefix, canToggle, isOwner = false) {
    // Check permission
    if (!canToggle) return false;

    // Find matching toggle command
    for (const toggle of TOGGLE_COMMANDS) {
        const fullCommand = `.${toggle.command}`;
        const prefixCommand = `${prefix}${toggle.command}`;

        // Check if message matches this toggle
        if (lower === fullCommand || lower === prefixCommand) {
            
            // Check owner-only restriction
            if (toggle.ownerOnly && !isOwner) {
                await sock.sendMessage(jid, {
                    text: [
                        '╭' + '─'.repeat(30) + '╮',
                        '┃  👑 *Owner Only!*  ┃',
                        '╰' + '─'.repeat(30) + '╯',
                        '',
                        `Only the bot owner can toggle *${toggle.name}*.`,
                        '',
                        beautifulFooter()
                    ].join('\n')
                });
                return true;
            }

            // Set the main toggle value
            await db.set(toggle.key, toggle.value);

            // Set any extra keys (e.g., autostatus sets both view + react)
            if (toggle.extraSet) {
                for (const [extraKey, extraValue] of Object.entries(toggle.extraSet)) {
                    await db.set(extraKey, extraValue);
                }
            }

            // Build beautiful response
            const isOn = toggle.value === true;
            const responseLines = [
                '╭' + '─'.repeat(36) + '╮',
                '┃  ' + toggle.emoji + ' *' + toggle.name + '*  ' + 
                    (isOn ? '✅ *ON*' : '❌ *OFF*').padEnd(12) + '┃',
                '╰' + '─'.repeat(36) + '╯',
                ''
            ];

            // Add description if available
            if (toggle.description && isOn) {
                responseLines.push('📝 ' + toggle.description);
                responseLines.push('');
            }

            // Add toggle hint
            const oppositeAction = toggle.command.includes(' on') ? 'off' : 'on';
            responseLines.push('💡 Use *.' + toggle.command.replace(/on|off/, oppositeAction) + '* to toggle');
            responseLines.push('');
            responseLines.push(beautifulFooter());

            await sock.sendMessage(jid, {
                text: responseLines.join('\n')
            });

            console.log(`🔘 Toggle: ${toggle.name} → ${isOn ? 'ON' : 'OFF'}`);
            return true;
        }
    }

    return false;
}

// ============================================================
// 📋 TOGGLE LIST
// ============================================================

/**
 * 💝 Get All Available Toggles
 * Returns formatted list of toggle commands
 * 
 * @param {string} prefix - Command prefix
 * @param {boolean} isOwner - Is user owner?
 * @returns {string} - Formatted toggle list
 */
function getToggleList(prefix, isOwner = false) {
    const categories = {
        '🔒 Security': ['antilink', 'antiview'],
        '👥 Group': ['welcome', 'goodbye'],
        '🎵 Media': ['voice'],
        '📝 Display': ['autobio', 'buttons'],
        '📰 News': ['autonews'],
        '🖤 Status': ['autostatus']
    };

    const lines = [
        '╭' + '─'.repeat(36) + '╮',
        '┃     🔘 *Toggle Commands* 🔘     ┃',
        '╰' + '─'.repeat(36) + '╯',
        ''
    ];

    for (const [category, commands] of Object.entries(categories)) {
        const categoryToggles = TOGGLE_COMMANDS.filter(t => 
            commands.some(c => t.command.startsWith(c))
        );

        if (categoryToggles.length === 0) continue;

        lines.push(`*${category}*`);
        for (const toggle of categoryToggles) {
            if (toggle.ownerOnly && !isOwner) continue;
            const action = toggle.command.includes(' on') ? 'ON' : 'OFF';
            lines.push(`  ${toggle.emoji} ${prefix}${toggle.command.padEnd(18)} ─ Turn ${action}`);
        }
        lines.push('');
    }

    lines.push(beautifulFooter());

    return lines.join('\n');
}

// ============================================================
// 🔧 TOGGLE UTILITIES
// ============================================================

/**
 * Check if a message is a toggle command
 * @param {string} text - Message text
 * @param {string} prefix - Command prefix
 * @returns {boolean} - True if it's a toggle command
 */
function isToggleCommand(text, prefix) {
    const lower = text.toLowerCase().trim();
    return TOGGLE_COMMANDS.some(toggle => {
        return lower === `.${toggle.command}` || lower === `${prefix}${toggle.command}`;
    });
}

/**
 * Get toggle info by command
 * @param {string} command - Toggle command
 * @returns {Object|null} - Toggle configuration or null
 */
function getToggleInfo(command) {
    return TOGGLE_COMMANDS.find(t => t.command === command) || null;
}

// ============================================================
// 📤 EXPORTS
// ============================================================
module.exports = {
    handleToggles,
    getToggleList,
    isToggleCommand,
    getToggleInfo,
    TOGGLE_COMMANDS
};
