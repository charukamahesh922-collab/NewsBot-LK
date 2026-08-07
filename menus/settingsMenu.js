const axios = require('axios');

// ═══════════════════════════════════════════════════════
// 📁 VOICE REPLIES
// ═══════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

let voiceReplies = { replies: {} };
try {
    const voiceFilePath = path.join(__dirname, '..', 'voiceReplies.json');
    if (fs.existsSync(voiceFilePath)) {
        voiceReplies = JSON.parse(fs.readFileSync(voiceFilePath, 'utf8'));
    }
} catch (e) {
    console.log('⚠️ voiceReplies.json not found');
}

// ═══════════════════════════════════════════════════════
// 🎨 HELPERS
// ═══════════════════════════════════════════════════════

const react = async (sock, jid, key, emoji) => {
    try { await sock.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
};

const footer = () => '🦄💝 *NewsBot LK* | Charuka Mahesh';

const on  = '✅ ON';
const off = '❌ OFF';
const badge = (v) => v ? on : off;

const MODE_EMOJIS = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };

const formatUptime = (seconds) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    let str = '';
    if (d > 0) str += d + 'd ';
    if (h > 0) str += h + 'h ';
    if (m > 0) str += m + 'm ';
    str += s + 's';
    return str;
};

// ═══════════════════════════════════════════════════════
// 📦 COMPACT BOX BUILDERS
// ═══════════════════════════════════════════════════════

const topBox = (emoji, title) => `╭━━━ ${emoji} *${title}* ━━━╮`;
const cmdLine = (prefix, command) => `│ ❯ ${prefix}${command}`;
const bottomBox = () => '╰━━━━━━━━━━━━━━━━━━━━━━╯';

const menuSection = (emoji, title, commands, prefix) => {
    const lines = [topBox(emoji, title)];
    for (const cmd of commands) lines.push(cmdLine(prefix, cmd));
    lines.push(bottomBox());
    return lines.join('\n');
};

// ═══════════════════════════════════════════════════════
// ⚙️ SETTINGS MENU
// ═══════════════════════════════════════════════════════

async function sendSettingsMenu(sock, jid, db, isOwner, config) {
    try {
        if (!isOwner) {
            const sent = await sock.sendMessage(jid, {
                text: [
                    '╭━━━━━━━━━━━━━━━━━━━━━━╮',
                    '┃      🔒 *ACCESS DENIED*',
                    '╰━━━━━━━━━━━━━━━━━━━━━━╯',
                    '',
                    '  ❌ This command is *Owner Only*',
                    '  🔒 You don\'t have permission',
                    '',
                    '  💡 This protects bot settings',
                    '',
                    footer()
                ].join('\n')
            });
            await react(sock, jid, sent.key, '🔒');
            return;
        }

        const s = await db.all();
        const bans = await db.banAll() || [];
        const urlCount = await db.urlsCount ? await db.urlsCount() : 0;
        const mode = s.botMode || 'public';
        const prefix = s.prefix || '.';
        const uptimeStr = formatUptime(process.uptime());
        const modeLabel = mode.toUpperCase();
        const modeEmoji = MODE_EMOJIS[mode] || '🌍';

        const sections = [];

        // Status Box
        sections.push([
            '┏━━━━━━━━━━━━━━━━━━┓',
            '┃ ⚙️ *BOT SETTINGS*',
            '┗━━━━━━━━━━━━━━━━━━┛',
            `┃ 🌍 Mode      : ${modeLabel} ${modeEmoji}`,
            `┃ 🔧 Prefix    : ${prefix}`,
            `┃ 📦 Version   : v${config.version || '9.0.4'}`,
            `┃ ⏱️ Uptime    : ${uptimeStr}`,
            `┃ 📰 News Sent : ${urlCount}`,
            `┃ 🚫 Banned    : ${Array.isArray(bans) ? bans.length : 0}`,
            `┃ 🗄️ DB        : ${s.useMongo ? 'MongoDB' : 'JSON'}`,
            '┗━━━━━━━━━━━━━━━━━━┛'
        ].join('\n'));

        // News Settings
        sections.push(menuSection('📰', 'NEWS SETTINGS', [
            `autonews      ${badge(s.autoNewsEnabled)}`,
            `setinterval   ${s.checkIntervalMs ? (s.checkIntervalMs / 60000) + 'min' : '2min'}`,
            'clearnews',
            `news          ${urlCount} sent`
        ], prefix));

        // Status Settings
        sections.push(menuSection('🖤', 'STATUS SETTINGS', [
            `autostatus    ${badge(s.autoStatusView)}`,
            `statusreact   ${badge(s.autoStatusReact)}`,
            `statussave    ${badge(s.autoStatusSave)}`
        ], prefix));

        // Security Settings
        sections.push(menuSection('🛡️', 'SECURITY SETTINGS', [
            `antilink      ${badge(s.antiLinkEnabled)}`,
            `antibadword   ${badge(s.antiBadWordEnabled)}`,
            `antispam      ${badge(s.antiSpamEnabled)}`,
            `slowmode      ${badge(s.slowModeEnabled || false)}`
        ], prefix));

        // Voice Settings
        sections.push(menuSection('🎵', 'VOICE SETTINGS', [
            `voice         ${badge(s.voiceReplyEnabled)}`,
            `voicelist     ${Object.keys(voiceReplies?.replies || {}).length} files`,
            'addvoice',
            'removevoice'
        ], prefix));

        // Group Settings
        sections.push(menuSection('👥', 'GROUP SETTINGS', [
            `welcome       ${badge(s.welcomeEnabled)}`,
            `goodbye       ${badge(s.goodbyeEnabled)}`,
            `mute          ${badge(s.isMuted || false)}`,
            `lock          ${badge(s.isLocked || false)}`
        ], prefix));

        // Display Settings
        sections.push(menuSection('✨', 'DISPLAY SETTINGS', [
            `autobio       ${badge(s.autoBioEnabled)}`,
            'setbotname',
            'setbio',
            'setpp',
            'removepp'
        ], prefix));

        // New Features
        sections.push(menuSection('🆕', 'NEW FEATURES', [
            `markunread    ${badge(s.markUnreadEnabled || false)}`,
            `clearchat     ${badge(s.clearChatEnabled || false)}`,
            'label',
            'removelabel',
            'edit',
            'react',
            'document',
            'search',
            'typing',
            'recording',
            'online',
            'offline'
        ], prefix));

        // Owner Commands
        sections.push(menuSection('👑', 'OWNER COMMANDS', [
            'mode',
            'setprefix',
            'setinterval',
            'resetsettings',
            'broadcast',
            'ban / unban',
            'banlist',
            'dm',
            'groups',
            'findgroup',
            'restart',
            'logout',
            'ownerhelp',
            'botstats',
            'privacy',
            'setprivacy',
            'block / unblock',
            'blocklist',
            'archive / unarchive',
            'mutechat',
            'pinchat / unpinchat',
            'deletechat',
            'star / unstar',
            'history',
            'getstatus',
            'getpp',
            'bizprofile',
            'subscribe',
            'poststatus',
            'broadcastinfo',
            'defaultdisappear',
            'presence',
            'check'
        ], prefix));

        const fullMenu = [
            '╭━━━━━━━━━━━━━━━━━━━━━━╮',
            '        ⚙️ *BOT SETTINGS*',
            '        💝 NewsBot LK v9.0.4',
            '╰━━━━━━━━━━━━━━━━━━━━━━╯',
            '',
            ...sections,
            '',
            '┏━━━━━━━━━━━━━━━━━━┓',
            '┃ 📊 *SYSTEM INFO*',
            '┗━━━━━━━━━━━━━━━━━━┛',
            `┃ 🧠 Memory : ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`,
            `┃ 📱 OS     : ${process.platform}`,
            `┃ 👨‍💻 Dev  : ${config.developer || 'Charuka Mahesh'}`,
            '┗━━━━━━━━━━━━━━━━━━┛',
            '',
            '╭━━━━━━━━━━━━━━━━━━━━━━╮',
            '   🦄 *NewsBot LK*',
            '   Made with ❤️ in Sri Lanka 🇱🇰',
            '╰━━━━━━━━━━━━━━━━━━━━━━╯'
        ].join('\n');

        try {
            if (config.botLogo) {
                const imgRes = await axios.get(config.botLogo, {
                    responseType: 'arraybuffer', timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (imgRes.data?.length > 1000) {
                    const sent = await sock.sendMessage(jid, {
                        image: Buffer.from(imgRes.data),
                        caption: fullMenu, mimetype: 'image/png'
                    });
                    await react(sock, jid, sent.key, '⚙️');
                    console.log('✅ Settings sent with image');
                    return;
                }
            }
        } catch (e) {}

        const sent = await sock.sendMessage(jid, { text: fullMenu });
        await react(sock, jid, sent.key, '⚙️');
        console.log('✅ Settings sent (text)');

    } catch (error) {
        console.error('❌ sendSettingsMenu error:', error.message);
        await sock.sendMessage(jid, {
            text: [
                '╭━━━━━━━━━━━━━━━━━━━━━━╮',
                '┃   ❌ *ERROR LOADING*',
                '╰━━━━━━━━━━━━━━━━━━━━━━╯',
                '',
                `  ❌ ${error.message}`,
                '',
                '  🔄 Please try again',
                '',
                footer()
            ].join('\n')
        });
    }
}

// ═══════════════════════════════════════════════════════
// 📋 QUICK SETTINGS
// ═══════════════════════════════════════════════════════

async function sendQuickSettings(sock, jid, db, isOwner) {
    if (!isOwner) {
        await sock.sendMessage(jid, { text: '❌ *Owner only!*' });
        return;
    }

    const s = await db.all();
    const lines = [
        '╭━━━━━━━━━━━━━━━━━━━━━━╮',
        '     ⚡ *QUICK SETTINGS*',
        '╰━━━━━━━━━━━━━━━━━━━━━━╯',
        '',
        '┏━━━━━━━━━━━━━━━━━━┓',
        '┃ 📰 News',
        '┗━━━━━━━━━━━━━━━━━━┛',
        `┃ Auto News : ${badge(s.autoNewsEnabled)}`,
        '┗━━━━━━━━━━━━━━━━━━┛',
        '',
        '┏━━━━━━━━━━━━━━━━━━┓',
        '┃ 🖤 Status',
        '┗━━━━━━━━━━━━━━━━━━┛',
        `┃ Auto View : ${badge(s.autoStatusView)}`,
        `┃ Auto React: ${badge(s.autoStatusReact)}`,
        `┃ Auto Save : ${badge(s.autoStatusSave)}`,
        '┗━━━━━━━━━━━━━━━━━━┛',
        '',
        '┏━━━━━━━━━━━━━━━━━━┓',
        '┃ 🛡️ Security',
        '┗━━━━━━━━━━━━━━━━━━┛',
        `┃ Anti-Link : ${badge(s.antiLinkEnabled)}`,
        `┃ Bad Word  : ${badge(s.antiBadWordEnabled)}`,
        `┃ Anti-Spam : ${badge(s.antiSpamEnabled)}`,
        '┗━━━━━━━━━━━━━━━━━━┛',
        '',
        '┏━━━━━━━━━━━━━━━━━━┓',
        '┃ 👥 Group',
        '┗━━━━━━━━━━━━━━━━━━┛',
        `┃ Welcome   : ${badge(s.welcomeEnabled)}`,
        `┃ Goodbye   : ${badge(s.goodbyeEnabled)}`,
        `┃ Voice     : ${badge(s.voiceReplyEnabled)}`,
        '┗━━━━━━━━━━━━━━━━━━┛',
        '',
        `🌍 Mode: *${(s.botMode || 'public').toUpperCase()}*  🔧 Prefix: *${s.prefix || '.'}*`,
        '',
        '💡 Use `.settings` for full menu',
        '',
        footer()
    ];

    await sock.sendMessage(jid, { text: lines.join('\n') });
}

// ═══════════════════════════════════════════════════════
// 🔧 SETTINGS COMMANDS
// ═══════════════════════════════════════════════════════

async function handleSettingsCommands(sock, msg, jid, text, lower, sender, db, isOwner) {
    if (!isOwner) {
        await sock.sendMessage(jid, { text: '❌ *Owner only!*' });
        return;
    }

    if (lower.startsWith('.setinterval ') || lower.startsWith('setinterval ')) {
        const mins = parseInt(text.replace(/^\.?setinterval\s+/, '').trim());
        if (!mins || mins < 1) {
            await sock.sendMessage(jid, {
                text: [
                    '╭━━━━━━━━━━━━━━━━━━━━━━╮',
                    '┃      💡 *USAGE*',
                    '╰━━━━━━━━━━━━━━━━━━━━━━╯',
                    '',
                    '  📝 `.setinterval <minutes>`',
                    '  ⏱️ Min: 1 minute',
                    '  💡 Example: `.setinterval 5`',
                    '',
                    footer()
                ].join('\n')
            });
            return;
        }
        await db.set('checkIntervalMs', mins * 60000);
        const sent = await sock.sendMessage(jid, {
            text: [
                '╭━━━━━━━━━━━━━━━━━━━━━━╮',
                '┃    ⏱️ *INTERVAL SET*',
                '╰━━━━━━━━━━━━━━━━━━━━━━╯',
                '',
                `  ✅ New interval: *${mins} minutes*`,
                '',
                footer()
            ].join('\n')
        });
        await react(sock, jid, sent.key, '✅');
        return;
    }

    if (lower === '.resetsettings' || lower === 'resetsettings') {
        const defaults = {
            botMode: 'public', prefix: '.',
            autoNewsEnabled: false, autoStatusView: false,
            autoStatusReact: false, autoStatusSave: false,
            autoBioEnabled: false, antiLinkEnabled: false,
            antiBadWordEnabled: false, antiSpamEnabled: false,
            voiceReplyEnabled: true, welcomeEnabled: false,
            goodbyeEnabled: false, slowModeEnabled: false,
            checkIntervalMs: 120000
        };
        for (const [k, v] of Object.entries(defaults)) await db.set(k, v);

        const sent = await sock.sendMessage(jid, {
            text: [
                '╭━━━━━━━━━━━━━━━━━━━━━━╮',
                '┃    🔄 *SETTINGS RESET*',
                '╰━━━━━━━━━━━━━━━━━━━━━━╯',
                '',
                '  ✅ All settings restored to default',
                '',
                footer()
            ].join('\n')
        });
        await react(sock, jid, sent.key, '🔄');
        return;
    }

    return false;
}

module.exports = {
    sendSettingsMenu,
    sendQuickSettings,
    handleSettingsCommands
};
