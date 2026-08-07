// menus/mainMenu.js

const axios = require('axios');

const react = async (sock, jid, key, emoji) => {
    try { await sock.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
};

const MODE_EMOJIS = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };

const formatUptime = (seconds) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return (d > 0 ? d + 'd ' : '') + h + 'h ' + m + 'm';
};

async function sendMainMenu(sock, jid, db, config, owner, admin, isGroup, prefix) {
    try {
        const mode = await db.get('botMode', 'public');
        const urlCount = await db.urlsCount ? await db.urlsCount() : 0;
        const uptime = process.uptime();
        const modeLabel = mode.toUpperCase();
        const modeEmoji = MODE_EMOJIS[mode] || '🌍';

        const menu = [];

        menu.push('╭━━━━━━━━━━━━━━━━━━━━━━╮');
        menu.push('    💝 *N E W S B O T  L K* 💝');
        menu.push('    🦄 Sri Lanka\'s #1 News Bot');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━╯');
        menu.push('');
        menu.push('┏━━━━━━━━━━━━━━━━━━┓');
        menu.push('┃ 🔐 *BOT STATUS*');
        menu.push('┗━━━━━━━━━━━━━━━━━━┛');
        menu.push(`┃ Mode      : ${modeLabel} ${modeEmoji}`);
        menu.push(`┃ Prefix    : ${prefix}`);
        menu.push(`┃ Version   : v${config.version || '9.0.4'}`);
        menu.push(`┃ Owner     : ${config.developer || 'Charuka Mahesh'}`);
        menu.push(`┃ Uptime    : ${formatUptime(uptime)}`);
        menu.push(`┃ News Sent : ${urlCount} 📰`);
        menu.push('┃ Commands  : 177 ⚡');
        menu.push('┗━━━━━━━━━━━━━━━━━━┛');
        menu.push('');
        menu.push('');
        menu.push('╭━━━ 📰 *NEWS CENTER* (8) ━━━╮');
        menu.push('│ .news');
        menu.push('│ .stats');
        menu.push('│ .about');
        menu.push('│ .ping');
        menu.push('│ .time');
        menu.push('│ .weather <city>');
        menu.push('│ .menu');
        menu.push('│ .help');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
        menu.push('');
        menu.push('');
        menu.push('╭━━━ 💾 *MEDIA STUDIO* (13) ━━━╮');
        menu.push('│ .save');
        menu.push('│ .ssave');
        menu.push('│ .vv');
        menu.push('│ .sticker / .s');
        menu.push('│ .toimg');
        menu.push('│ .togif');
        menu.push('│ .emoji');
        menu.push('│ .removebg / .nobg');
        menu.push('│ .gif');
        menu.push('│ .ptv');
        menu.push('│ .qs');
        menu.push('│ .document');
        menu.push('│ .forward');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
        menu.push('');
        menu.push('');
        menu.push('╭━━━ 📱 *STATUS TOOLS* (6) ━━━╮');
        menu.push('│ .save');
        menu.push('│ .savetome');
        menu.push('│ .statusstats');
        menu.push('│ .autostatus on/off');
        menu.push('│ .autostatussave on/off');
        menu.push('│ .poststatus <text>');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
        menu.push('');
        menu.push('');
        menu.push('╭━━━ 👥 *GROUP TOOLS* (12) ━━━╮');
        menu.push('│ .admins');
        menu.push('│ .members / .list');
        menu.push('│ .groupinfo / .gi / .gcinfo');
        menu.push('│ .jid / .groupjid');
        menu.push('│ .tagall / .everyone / .all');
        menu.push('│ .tagadmins');
        menu.push('│ .pick / .random');
        menu.push('│ .poll');
        menu.push('│ .custompoll');
        menu.push('│ .afk');
        menu.push('│ .link / .invitelink');
        menu.push('│ .revoke');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
        menu.push('');
        menu.push('');
        menu.push('╭━━━ 🎮 *FUN & GAMES* (6) ━━━╮');
        menu.push('│ .dice / .roll');
        menu.push('│ .flip / .coinflip');
        menu.push('│ .quote');
        menu.push('│ .8ball');
        menu.push('│ .roast @user');
        menu.push('│ .compliment @user');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
        menu.push('');
        menu.push('');
        menu.push('╭━━━ 🔤 *TEXT TOOLS* (4) ━━━╮');
        menu.push('│ .upper');
        menu.push('│ .lower');
        menu.push('│ .reverse');
        menu.push('│ .count');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
        menu.push('');
        menu.push('');
        menu.push('╭━━━ 🔧 *UTILITIES* (9) ━━━╮');
        menu.push('│ .getpp @user');
        menu.push('│ .mypp');
        menu.push('│ .myabout');
        menu.push('│ .check <num>');
        menu.push('│ .location lat,lng');
        menu.push('│ .edit');
        menu.push('│ .react 😊');
        menu.push('│ .search <query>');
        menu.push('│ .sendcontact');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
        menu.push('');
        menu.push('');
        menu.push('╭━━━ 🟢 *PRESENCE* (5) ━━━╮');
        menu.push('│ .typing');
        menu.push('│ .recording');
        menu.push('│ .online');
        menu.push('│ .offline');
        menu.push('│ .presence <status>');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
        menu.push('');
        menu.push('');
        menu.push('╭━━━ ⬇️ *DOWNLOADER* (8) ━━━╮');
        menu.push('│ .yt <url>');
        menu.push('│ .ytmp3 <url>');
        menu.push('│ .ytmp4 <url>');
        menu.push('│ .ig <url>');
        menu.push('│ .fb <url>');
        menu.push('│ .tt <url>');
        menu.push('│ .pin <url>');
        menu.push('│ .google <query>');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
        menu.push('');
        menu.push('');
        menu.push('╭━━━ 🔗 *MESSAGE TOOLS* (5) ━━━╮');
        menu.push('│ .pin');
        menu.push('│ .unpin');
        menu.push('│ .delete / .del');
        menu.push('│ .edit');
        menu.push('│ .react');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
        menu.push('');
        menu.push('');

        if (admin || owner) {
            menu.push('╭━━━ 🛡️ *ADMIN COMMANDS* (47) ━━━╮');
            menu.push('│ .mute');
            menu.push('│ .mute <mins>');
            menu.push('│ .unmute');
            menu.push('│ .warn @user');
            menu.push('│ .clearwarn @user');
            menu.push('│ .warnlist');
            menu.push('│ .kick @user');
            menu.push('│ .add <number>');
            menu.push('│ .promote @user');
            menu.push('│ .demote @user');
            menu.push('│ .setname <name>');
            menu.push('│ .setdesc <desc>');
            menu.push('│ .lock / .unlock');
            menu.push('│ .open / .close');
            menu.push('│ .memberadd on/off');
            menu.push('│ .invitelink / .invite');
            menu.push('│ .revokeinvite / .resetlink');
            menu.push('│ .disappear 24h/7d/90d/off');
            menu.push('│ .joinrequests');
            menu.push('│ .approveall / .rejectall');
            menu.push('│ .groupinfo / .ginfo');
            menu.push('│ .members / .memberlist');
            menu.push('│ .antilink on/off');
            menu.push('│ .antibadword on/off');
            menu.push('│ .antispam on/off');
            menu.push('│ .welcome on/off');
            menu.push('│ .goodbye on/off');
            menu.push('│ .voice on/off');
            menu.push('│ .pin / .delete / .del');
            menu.push('│ .slowmode <secs/off>');
            menu.push('│ .creategroup <name>');
            menu.push('│ .leavegroup');
            menu.push('│ .joingroup <code>');
            menu.push('│ .groupinviteinfo <code>');
            menu.push('│ .mygroups');
            menu.push('│ .adminsettings / .asettings');
            menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
            menu.push('');
            menu.push('');
        }

        if (owner) {
            menu.push('╭━━━ 👑 *OWNER COMMANDS* (55) ━━━╮');
            menu.push('│ .mode public/private/inbox/groups');
            menu.push('│ .restart');
            menu.push('│ .logout');
            menu.push('│ .botstats / .bs');
            menu.push('│ .setprefix <char>');
            menu.push('│ .autonews on/off');
            menu.push('│ .clearnews');
            menu.push('│ .autostatus on/off');
            menu.push('│ .autostatussave on/off');
            menu.push('│ .autobio on/off');
            menu.push('│ .ban @user');
            menu.push('│ .unban @user');
            menu.push('│ .banlist');
            menu.push('│ .block @user');
            menu.push('│ .unblock @user');
            menu.push('│ .blocklist');
            menu.push('│ .privacy');
            menu.push('│ .setprivacy <type> <val>');
            menu.push('│ .defaultdisappear 24h/7d/90d/off');
            menu.push('│ .presence available/unavailable');
            menu.push('│ .presence composing/recording');
            menu.push('│ .broadcast <msg>');
            menu.push('│ .dm @user <msg>');
            menu.push('│ .broadcastinfo <jid>');
            menu.push('│ .setbotname / .setname');
            menu.push('│ .setbio / .setabout');
            menu.push('│ .setpp');
            menu.push('│ .removepp');
            menu.push('│ .groups / .listgroups');
            menu.push('│ .findgroup <name>');
            menu.push('│ .markunread / .clearchat');
            menu.push('│ .archive / .unarchive');
            menu.push('│ .mutechat 8h/7d/off');
            menu.push('│ .pinchat / .unpinchat');
            menu.push('│ .deletechat');
            menu.push('│ .markread / .star / .unstar');
            menu.push('│ .history');
            menu.push('│ .document');
            menu.push('│ .getstatus @user');
            menu.push('│ .getpp @user');
            menu.push('│ .bizprofile @user');
            menu.push('│ .subscribe @user');
            menu.push('│ .check <number>');
            menu.push('│ .approve <num> / .reject <num>');
            menu.push('│ .voicelist');
            menu.push('│ .addvoice <trigger> <url>');
            menu.push('│ .removevoice <trigger>');
            menu.push('│ .label <id> / .removelabel <id>');
            menu.push('│ .ownerhelp / .oh');
            menu.push('│ .settings');
            menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯');
            menu.push('');
            menu.push('');
        }

        menu.push('');
        menu.push('💡 *Total: 177 Commands + 160 Voice Triggers*');
        menu.push('');
        menu.push('');
        menu.push('╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮');
        menu.push('     🦄💝 *NewsBot LK v9.0.4* 💝🦄');
        menu.push(`     👨‍💻 ${config.developer || 'Charuka Mahesh'}`);
        menu.push('     💝 Umesha | Mithila | Sharada');
        menu.push('     Made with ❤️ in Sri Lanka 🇱🇰');
        menu.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯');

        const fullMenu = menu.join('\n');

        try {
            if (config.botLogo) {
                const imgRes = await axios.get(config.botLogo, {
                    responseType: 'arraybuffer', timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (imgRes.data?.length > 1000) {
                    const sent = await sock.sendMessage(jid, {
                        image: Buffer.from(imgRes.data),
                        caption: fullMenu,
                        mimetype: 'image/png'
                    });
                    await react(sock, jid, sent.key, '📋');
                    return;
                }
            }
        } catch (e) {}

        const sent = await sock.sendMessage(jid, { text: fullMenu });
        await react(sock, jid, sent.key, '📋');

    } catch (error) {
        console.error('❌ sendMainMenu error:', error.message);
        await sock.sendMessage(jid, { text: '❌ *Failed to send menu!*' });
    }
}

module.exports = { sendMainMenu };
