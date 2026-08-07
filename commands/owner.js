const axios = require('axios');
const { sendSettingsMenu } = require('../menus/settingsMenu');
const { jidDecode, jidNormalizedUser } = require('@whiskeysockets/baileys');

// ═══════════════════════════════════════════════════════
// 🛡️ SAFE SENDER HELPERS
// ═══════════════════════════════════════════════════════

function getSenderNumber(sender) {
    if (!sender) return 'unknown';
    try {
        const normalized = jidNormalizedUser(String(sender));
        const decoded = jidDecode(normalized);
        return decoded?.user || 'unknown';
    } catch {
        return String(sender).split('@')[0]?.replace(/[^0-9]/g, '') || 'unknown';
    }
}

function getSenderMention(sender) {
    const num = getSenderNumber(sender);
    return num !== 'unknown' ? num : String(sender).split('@')[0] || 'unknown';
}

// ═══════════════════════════════════════════════════════
// 🎨 BEAUTIFUL HELPERS
// ═══════════════════════════════════════════════════════

const react = async (sock, jid, key, emoji) => {
    try { await sock.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
};

const footer = () => '🦄💝 *NewsBot LK* | Charuka Mahesh';

const box = (title, lines) => [
    '╭' + '─'.repeat(38) + '╮',
    '┃  ' + title,
    '╰' + '─'.repeat(38) + '╯',
    '',
    ...lines,
    '',
    footer()
].join('\n');

const divider = (title) => '┄'.repeat(10) + ' ' + title + ' ' + '┄'.repeat(10);
const toggle = (enabled) => enabled ? '✅ *ON*' : '❌ *OFF*';

const MODE_EMOJIS = { private: '🔒', inbox: '📥', groups: '👥', public: '🌍' };

const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m ${secs}s`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
};

// ═══════════════════════════════════════════════════════
// 👑 OWNER COMMANDS HANDLER
// ═══════════════════════════════════════════════════════

async function handleOwnerCommands(sock, msg, jid, text, lower, sender, db, config) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const senderMention = getSenderMention(sender);
    const prefix = await db.get('prefix', '.');

    // ═══════════════════════════════════════
    // 🌍 BOT MODE
    // ═══════════════════════════════════════

    if (lower === '.mode' || lower.startsWith('.mode ') || lower === 'mode' || lower.startsWith('mode ')) {
        const ma = text.replace(/^\.?mode\s*/, '').trim().toLowerCase();
        const vm = ['private', 'inbox', 'groups', 'public'];
        if (vm.includes(ma)) {
            await db.set('botMode', ma);
            const sent = await sock.sendMessage(jid, {
                text: box(`${MODE_EMOJIS[ma]} *BOT MODE CHANGED*`, [
                    `  🔄 Mode: *${ma.toUpperCase()}*`,
                    '',
                    divider('📖 Info'),
                    ma === 'public'  ? '  🌍 Everyone can use the bot' :
                    ma === 'private' ? '  🔒 Only owner can use the bot' :
                    ma === 'inbox'   ? '  📥 Only DMs allowed' :
                                      '  👥 Only groups allowed',
                    '',
                    `  👮 Changed by: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [sender]
            });
            await react(sock, jid, sent.key, MODE_EMOJIS[ma]);
        } else {
            const cm = await db.get('botMode', 'public');
            const sent = await sock.sendMessage(jid, {
                text: box('🌍 *BOT MODE*', [
                    `  ${MODE_EMOJIS[cm]} Current: *${cm.toUpperCase()}*`,
                    '',
                    divider('📋 Available Modes'),
                    '  🌍 `.mode public`  — Everyone can use',
                    '  🔒 `.mode private` — Owner only',
                    '  📥 `.mode inbox`   — DMs only',
                    '  👥 `.mode groups`  — Groups only',
                    '',
                    '💡 Use `.mode <mode>` to change',
                ])
            });
            await react(sock, jid, sent.key, '🌍');
        }
        return;
    }
    
    // ═══════════════════════════════════════
// 📩 MARK CHAT UNREAD
// ═══════════════════════════════════════
if (lower === '.markunread' || lower === 'markunread') {
    try {
        await sock.chatModify({ markRead: false, lastMessages: [] }, jid);
        await sock.sendMessage(jid, { text: box('📩 *MARKED UNREAD*', [`👮 By: @${senderMention}`]), mentions: [sender] });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
    return;
}
    
// ═══════════════════════════════════════
// 👥 CREATE GROUP
// ═══════════════════════════════════════

if (lower.startsWith('.creategroup ') || lower.startsWith('creategroup ')) {
    const name = text.replace(/^\.?creategroup\s+/, '').trim();
    if (!name) {
        await sock.sendMessage(jid, { text: box('💡 *USAGE*', ['  📝 `.creategroup Group Name`']) });
        return;
    }
    try {
        await react(sock, jid, msg.key, '👥');
        const group = await sock.groupCreate(name, [sender]);
        await sock.sendMessage(jid, {
            text: box('👥 *GROUP CREATED*', [
                `  ✅ Name: *${name}*`,
                `  🆔 JID: ${group.id}`,
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch {
        await sock.sendMessage(jid, { text: '❌ *Failed to create group!*' });
    }
    return;
}

// ═══════════════════════════════════════
// 🧹 CLEAR CHAT
// ═══════════════════════════════════════
if (lower === '.clearchat' || lower === 'clearchat') {
    try {
        await sock.chatModify({ clear: { messages: [] } }, jid);
        await sock.sendMessage(jid, { text: box('🧹 *CHAT CLEARED*', [`👮 By: @${senderMention}`]), mentions: [sender] });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
    return;
}

// ═══════════════════════════════════════
// 🏷️ ADD CHAT LABEL
// ═══════════════════════════════════════
if (lower.startsWith('.label ') || lower.startsWith('label ')) {
    const labelId = text.replace(/^\.?label\s+/, '').trim();
    if (!labelId) { await sock.sendMessage(jid, { text: '💡 `.label <id>`' }); return; }
    try {
        await sock.addChatLabel(jid, labelId);
        await sock.sendMessage(jid, { text: box('🏷️ *LABEL ADDED*', [`  Label: *${labelId}*`]) });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
    return;
}

// ═══════════════════════════════════════
// 🗑️ REMOVE CHAT LABEL
// ═══════════════════════════════════════
if (lower.startsWith('.removelabel ') || lower.startsWith('removelabel ')) {
    const labelId = text.replace(/^\.?removelabel\s+/, '').trim();
    try {
        await sock.removeChatLabel(jid, labelId);
        await sock.sendMessage(jid, { text: box('🗑️ *LABEL REMOVED*', [`  Label: *${labelId}*`]) });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
    return;
}

// ═══════════════════════════════════════
// 📝 SET PROFILE NAME (same as setbotname but shorter)
// ═══════════════════════════════════════
if (lower.startsWith('.setname ') || lower.startsWith('setname ')) {
    const name = text.replace(/^\.?setname\s+/, '').trim();
    if (!name) { await sock.sendMessage(jid, { text: '💡 `.setname Your Name`' }); return; }
    try {
        await sock.updateProfileName(name);
        await sock.sendMessage(jid, { text: box('📝 *NAME UPDATED*', [`✅ *${name}*`]), mentions: [sender] });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
    return;
}

// ═══════════════════════════════════════
// 💬 SET ABOUT STATUS
// ═══════════════════════════════════════
if (lower.startsWith('.setabout ') || lower.startsWith('setabout ')) {
    const about = text.replace(/^\.?setabout\s+/, '').trim();
    if (!about) { await sock.sendMessage(jid, { text: '💡 `.setabout Your about text`' }); return; }
    try {
        await sock.updateProfileStatus(about);
        await sock.sendMessage(jid, { text: box('💬 *ABOUT UPDATED*', [`✅ *${about}*`]) });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
    return;
}

// ═══════════════════════════════════════
// ✅ APPROVE SINGLE JOIN REQUEST
// ═══════════════════════════════════════
if (lower.startsWith('.approve ') || lower.startsWith('approve ')) {
    const num = text.replace(/^\.?approve\s+/, '').replace(/[^0-9]/g, '');
    if (!num) { await sock.sendMessage(jid, { text: '💡 `.approve 947xxxxxxxxx`' }); return; }
    try {
        await sock.groupRequestParticipantsUpdate(jid, [num + '@s.whatsapp.net'], 'approve');
        await sock.sendMessage(jid, { text: box('✅ *APPROVED*', [`  +${num}`]) });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
    return;
}

// ═══════════════════════════════════════
// ❌ REJECT SINGLE JOIN REQUEST
// ═══════════════════════════════════════
if (lower.startsWith('.reject ') || lower.startsWith('reject ')) {
    const num = text.replace(/^\.?reject\s+/, '').replace(/[^0-9]/g, '');
    if (!num) { await sock.sendMessage(jid, { text: '💡 `.reject 947xxxxxxxxx`' }); return; }
    try {
        await sock.groupRequestParticipantsUpdate(jid, [num + '@s.whatsapp.net'], 'reject');
        await sock.sendMessage(jid, { text: box('❌ *REJECTED*', [`  +${num}`]) });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
    return;
}

// ═══════════════════════════════════════
// 📄 SEND DOCUMENT (owner can use too)
// ═══════════════════════════════════════
if (lower === '.document' || lower === 'document') {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) { await sock.sendMessage(jid, { text: '💡 Reply to media with `.document`' }); return; }
    try {
        const baileys = await import('@whiskeysockets/baileys');
        const buffer = await baileys.downloadMediaMessage({ message: quotedMsg }, 'buffer', {}, { logger: { info: () => {}, error: () => {}, warn: () => {} } });
        await sock.sendMessage(jid, { document: buffer, mimetype: 'application/pdf', fileName: `doc_${Date.now()}.pdf` });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
    return;
}

    // ═══════════════════════════════════════
    // 📰 AUTO NEWS
    // ═══════════════════════════════════════

    if (lower === '.autonews on') {
        await react(sock, jid, msg.key, '✅');
        await db.set('autoNewsEnabled', true);
        await sock.sendMessage(jid, {
            text: box('📰 *AUTO NEWS ENABLED*', [
                '  ✅ News will be *auto-posted*',
                `  ⏱️ Interval: every ${(config.checkIntervalMs || 120000) / 60000} minutes`,
                '  📡 Fetching from 15+ sources',
                `  👮 Changed by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.autonews off') {
        await react(sock, jid, msg.key, '❌');
        await db.set('autoNewsEnabled', false);
        await sock.sendMessage(jid, {
            text: box('📰 *AUTO NEWS DISABLED*', [
                '  ❌ Auto news is *OFF*',
                '  💡 Use `.news` to fetch manually',
                `  👮 Changed by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    // ═══════════════════════════════════════
    // 🖤 AUTO STATUS
    // ═══════════════════════════════════════

    if (lower === '.autostatus on') {
        await react(sock, jid, msg.key, '✅');
        await db.set('autoStatusView', true);
        await db.set('autoStatusReact', true);
        await sock.sendMessage(jid, {
            text: box('🖤 *AUTO STATUS ENABLED*', [
                '  ✅ Auto *view* statuses: *ON*',
                '  ✅ Auto *react* to statuses: *ON*',
                `  👮 Changed by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.autostatus off') {
        await react(sock, jid, msg.key, '❌');
        await db.set('autoStatusView', false);
        await db.set('autoStatusReact', false);
        await db.set('autoStatusSave', false);
        await sock.sendMessage(jid, {
            text: box('🖤 *AUTO STATUS DISABLED*', [
                '  ❌ Auto view: *OFF*',
                '  ❌ Auto react: *OFF*',
                '  ❌ Auto save: *OFF*',
                `  👮 Changed by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.autostatussave on') {
        await react(sock, jid, msg.key, '✅');
        await db.set('autoStatusSave', true);
        await sock.sendMessage(jid, {
            text: box('💾 *AUTO STATUS SAVE ON*', [
                '  ✅ Statuses will be *auto-saved*',
                `  👮 Changed by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.autostatussave off') {
        await react(sock, jid, msg.key, '❌');
        await db.set('autoStatusSave', false);
        await sock.sendMessage(jid, {
            text: box('💾 *AUTO STATUS SAVE OFF*', [
                '  ❌ Auto status save is *OFF*',
                `  👮 Changed by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    // ═══════════════════════════════════════
    // 🔧 PREFIX
    // ═══════════════════════════════════════

    if (lower.startsWith('.setprefix ') || lower.startsWith('setprefix ')) {
        const newPrefix = text.replace(/^\.?setprefix\s+/, '').trim().charAt(0);
        if (!newPrefix) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', [
                    '  📝 `.setprefix !`',
                    '  📝 `.setprefix #`',
                    '  📝 `.setprefix /`',
                    '  💡 Choose any single character',
                ])
            });
            return;
        }
        await react(sock, jid, msg.key, '🔧');
        await db.set('prefix', newPrefix);
        await sock.sendMessage(jid, {
            text: box('🔧 *PREFIX CHANGED*', [
                `  🔧 New prefix: *"${newPrefix}"*`,
                `  💡 Example: *${newPrefix}menu*`,
                `  👮 Changed by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    // ═══════════════════════════════════════
    // 📋 LIST GROUPS
    // ═══════════════════════════════════════

    if (lower === '.groups' || lower === 'groups' || lower === '.listgroups') {
        await react(sock, jid, msg.key, '📋');
        try {
            const groups = await sock.groupFetchAllParticipating();
            const entries = Object.entries(groups);
            const groupList = entries.map(([gid, data], i) =>
                `  ${i + 1}. *${data.subject}*\n     👥 ${data.participants.length} members`
            );
            await sock.sendMessage(jid, {
                text: box(`📋 *YOUR GROUPS (${entries.length})*`, [
                    ...groupList,
                    '',
                    divider('💡 Tips'),
                    '  • Use *.jid* in a group to get JID',
                    '  • Use *.findgroup name* to search',
                ])
            });
        } catch {
            await react(sock, jid, msg.key, '❌');
            await sock.sendMessage(jid, { text: '❌ *Failed to fetch groups!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🔍 FIND GROUP
    // ═══════════════════════════════════════

    if (lower.startsWith('.findgroup ') || lower.startsWith('findgroup ')) {
        const searchName = text.replace(/^\.?findgroup\s+/, '').trim().toLowerCase();
        if (!searchName) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.findgroup Name`', '', '  🔍 Search for groups by name'])
            });
            return;
        }
        await react(sock, jid, msg.key, '🔍');
        try {
            const groups = await sock.groupFetchAllParticipating();
            const found = Object.entries(groups).filter(([, data]) =>
                data.subject.toLowerCase().includes(searchName)
            );
            if (!found.length) {
                await sock.sendMessage(jid, {
                    text: box('🔍 *SEARCH RESULTS*', [
                        `  ❌ No groups found for "*${searchName}*"`,
                        '  💡 Try a different keyword',
                    ])
                });
            } else {
                const list = found.map(([gid, data], i) =>
                    `  ${i + 1}. *${data.subject}*\n     🆔 \`${gid}\`\n     👥 ${data.participants.length} members`
                );
                await sock.sendMessage(jid, {
                    text: box(`🔍 *FOUND ${found.length} GROUP(S)*`, [
                        ...list,
                        '',
                        '💡 Copy the JID for commands',
                    ])
                });
            }
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Error searching groups!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🚫 BAN SYSTEM
    // ═══════════════════════════════════════

    if (lower.startsWith('.ban ') || lower.startsWith('ban ')) {
        if (!mentioned.length) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.ban @user reason`', '', '  🚫 Bans a user from using the bot'])
            });
            return;
        }
        const target = mentioned[0];
        const reason = text.replace(/^\.?ban\s+@\S+\s*/, '').trim() || 'No reason given';
        await db.banAdd(target, reason);
        await react(sock, jid, msg.key, '🚫');
        await sock.sendMessage(jid, {
            text: box('🚫 *USER BANNED*', [
                `  👤 User: @${getSenderNumber(target)}`,
                `  📝 Reason: *${reason}*`,
                `  👮 Banned by: @${senderMention}`,
                `  ⏰ ${new Date().toLocaleString()}`,
                '',
                '  🔒 User cannot use the bot anymore',
            ]),
            mentions: [target, sender]
        });
        return;
    }

    if (lower.startsWith('.unban ') || lower.startsWith('unban ')) {
        if (!mentioned.length) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.unban @user`', '', '  ✅ Removes ban from a user'])
            });
            return;
        }
        const target = mentioned[0];
        await db.banRemove(target);
        await react(sock, jid, msg.key, '✅');
        await sock.sendMessage(jid, {
            text: box('✅ *USER UNBANNED*', [
                `  👤 @${getSenderNumber(target)} is now *free*`,
                `  👮 Unbanned by: @${senderMention}`,
                `  ⏰ ${new Date().toLocaleString()}`,
                '',
                '  🎉 User can use the bot again',
            ]),
            mentions: [target, sender]
        });
        return;
    }

    if (lower === '.banlist' || lower === 'banlist') {
        await react(sock, jid, msg.key, '📋');
        const bl = await db.banAll();
        const lines = bl.length
            ? bl.map((b, i) => `  ${i + 1}. @${getSenderNumber(b.userId)}${b.reason ? ' — ' + b.reason : ''}`)
            : ['  ✅ No banned users'];
        await sock.sendMessage(jid, {
            text: box(`🚫 *BAN LIST (${bl.length})*`, [
                ...lines,
                '',
                `  📊 Total banned: *${bl.length}*`,
            ]),
            mentions: bl.map(b => b.userId)
        });
        return;
    }

    // ═══════════════════════════════════════
    // 📢 BROADCAST
    // ═══════════════════════════════════════

    if (lower.startsWith('.broadcast ') || lower.startsWith('broadcast ')) {
        const bm = text.replace(/^\.?broadcast\s+/, '').trim();
        if (!bm) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.broadcast Your message here`', '', '  📢 Sends message to all groups'])
            });
            return;
        }
        await react(sock, jid, msg.key, '📢');
        await sock.sendMessage(jid, {
            text: box('📢 *BROADCASTING...*', [
                `  📝 Message: "${bm.substring(0, 50)}${bm.length > 50 ? '...' : ''}"`,
                '  ⏳ Sending to all groups...',
            ])
        });
        try {
            const gs = await sock.groupFetchAllParticipating();
            let success = 0, failed = 0;
            for (const gid of Object.keys(gs)) {
                try {
                    await sock.sendMessage(gid, {
                        text: box('📢 *BROADCAST*', [
                            bm,
                            '',
                            `  👮 From: *${config.botName || 'NewsBot LK'}*`,
                            `  📅 ${new Date().toLocaleString()}`,
                        ])
                    });
                    success++;
                } catch { failed++; }
                await new Promise(r => setTimeout(r, 1000));
            }
            await sock.sendMessage(jid, {
                text: box('📢 *BROADCAST COMPLETE*', [
                    `  ✅ Sent: *${success} groups*`,
                    `  ❌ Failed: *${failed} groups*`,
                    `  📊 Total: *${success + failed} groups*`,
                    `  👮 Sent by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Broadcast failed!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 📊 BOT STATS
    // ═══════════════════════════════════════

    if (lower === '.botstats' || lower === 'botstats' || lower === '.bs') {
        await react(sock, jid, msg.key, '📊');
        try {
            const groups = await sock.groupFetchAllParticipating();
            const urlCount = await db.urlsCount();
            const bans = await db.banAll();
            const settings = await db.all();
            const uptime = process.uptime();
            await sock.sendMessage(jid, {
                text: box('📊 *BOT STATISTICS*', [
                    divider('📈 Overview'),
                    `  👥 Groups: *${Object.keys(groups).length}*`,
                    `  📰 News Sent: *${urlCount}*`,
                    `  🚫 Banned: *${bans.length}*`,
                    '',
                    divider('⏱️ Uptime'),
                    `  🕐 ${formatUptime(uptime)}`,
                    '',
                    divider('⚙️ Settings'),
                    `  🌍 Mode: *${(settings.botMode || 'public').toUpperCase()}*`,
                    `  📰 Auto News: ${toggle(settings.autoNewsEnabled)}`,
                    `  🖤 Auto Status: ${toggle(settings.autoStatusView)}`,
                    `  🎵 Voice Replies: ${toggle(settings.voiceReplyEnabled)}`,
                    '',
                    divider('🤖 System'),
                    `  📦 Version: *${config.version || '9.0.2'}*`,
                    `  🔧 Prefix: *"${settings.prefix || '.'}"*`,
                    `  🗄️ Database: *${settings.useMongo ? 'MongoDB' : 'JSON'}*`,
                    '',
                    `  👑 Owner: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Error fetching stats!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🔄 RESTART / LOGOUT BOT
    // ═══════════════════════════════════════

    if (lower === '.restart' || lower === 'restart') {
        await react(sock, jid, msg.key, '🔄');
        await sock.sendMessage(jid, {
            text: box('🔄 *RESTARTING BOT*', [
                '  ⏳ Bot will restart in *3 seconds*',
                `  👮 Requested by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        setTimeout(() => process.exit(0), 3000);
        return;
    }

    if (lower === '.logout' || lower === 'logout') {
        await react(sock, jid, msg.key, '🚪');
        await sock.sendMessage(jid, {
            text: box('🚪 *LOGGING OUT*', [
                '  ⚠️ Bot will logout & invalidate session',
                '  🔑 You will need to re-scan QR code',
                `  👮 Requested by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        setTimeout(async () => {
            try { await sock.logout(); } catch { process.exit(0); }
        }, 3000);
        return;
    }

    // ═══════════════════════════════════════
    // 🗑️ CLEAR NEWS CACHE
    // ═══════════════════════════════════════

    if (lower === '.clearnews' || lower === 'clearnews') {
        await react(sock, jid, msg.key, '🗑️');
        try {
            const before = await db.urlsCount();
            if (db.urlsClear) {
                await db.urlsClear();
            } else {
                const { jsonDb, saveJsonDb } = require('../utils/db');
                jsonDb.sentUrls = [];
                saveJsonDb();
            }
            await sock.sendMessage(jid, {
                text: box('🗑️ *NEWS CACHE CLEARED*', [
                    `  🗑️ Cleared *${before}* tracked URLs`,
                    '  📰 Next fetch will send all news',
                    `  👮 Cleared by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to clear cache!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 📝 SET BOT NAME
    // ═══════════════════════════════════════

    if (lower.startsWith('.setbotname ') || lower.startsWith('setbotname ')) {
        const name = text.replace(/^\.?setbotname\s+/, '').trim();
        if (!name) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.setbotname New Bot Name`'])
            });
            return;
        }
        try {
            await react(sock, jid, msg.key, '✅');
            await sock.updateProfileName(name);
            await sock.sendMessage(jid, {
                text: box('📝 *BOT NAME UPDATED*', [
                    `  ✅ New name: *${name}*`,
                    `  👮 Changed by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to update name!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 💬 SET BOT BIO
    // ═══════════════════════════════════════

    if (lower.startsWith('.setbio ') || lower.startsWith('setbio ')) {
        const bio = text.replace(/^\.?setbio\s+/, '').trim();
        if (!bio) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.setbio Your bio text here`'])
            });
            return;
        }
        try {
            await react(sock, jid, msg.key, '✅');
            await sock.updateProfileStatus(bio);
            await sock.sendMessage(jid, {
                text: box('💬 *BIO UPDATED*', [
                    `  ✅ New bio: *${bio}*`,
                    `  👮 Changed by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to update bio!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 📸 SET BOT PROFILE PICTURE
    // ═══════════════════════════════════════

    if (lower === '.setpp' || lower === 'setpp') {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted?.imageMessage) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📸 Reply to an image with `.setpp`'])
            });
            return;
        }
        try {
            await react(sock, jid, msg.key, '✅');
            const baileys = await import('@whiskeysockets/baileys');
            const buf = await baileys.downloadMediaMessage(
                { message: quoted }, 'buffer', {},
                { logger: { info: () => {}, error: () => {}, warn: () => {} } }
            );
            await sock.updateProfilePicture(sock.user.id, buf);
            await sock.sendMessage(jid, {
                text: box('📸 *PROFILE PICTURE UPDATED*', [
                    '  ✅ Bot profile picture changed!',
                    `  👮 Changed by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to update profile picture!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🗑️ REMOVE BOT PROFILE PICTURE
    // ═══════════════════════════════════════

    if (lower === '.removepp' || lower === 'removepp') {
        try {
            await react(sock, jid, msg.key, '🗑️');
            await sock.removeProfilePicture(sock.user.id);
            await sock.sendMessage(jid, {
                text: box('🗑️ *PROFILE PICTURE REMOVED*', [
                    '  ✅ Bot profile picture removed!',
                    `  👮 Changed by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to remove profile picture!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 📨 DM USER
    // ═══════════════════════════════════════

    if (lower.startsWith('.dm ') || lower.startsWith('dm ')) {
        if (!mentioned.length) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.dm @user Your message here`'])
            });
            return;
        }
        const target = mentioned[0];
        const dmText = text.replace(/^\.?dm\s+@\S+\s*/, '').trim();
        if (!dmText) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.dm @user Your message here`', '  💬 Message cannot be empty'])
            });
            return;
        }
        try {
            await react(sock, jid, msg.key, '✅');
            await sock.sendMessage(target, {
                text: box('📨 *MESSAGE FROM OWNER*', [
                    dmText,
                    '',
                    `  📅 ${new Date().toLocaleString()}`,
                ])
            });
            await sock.sendMessage(jid, {
                text: box('📨 *DM SENT*', [
                    `  ✅ Message sent to @${getSenderNumber(target)}`,
                    `  📝 Content: "${dmText.substring(0, 50)}${dmText.length > 50 ? '...' : ''}"`,
                    `  👮 Sent by: @${senderMention}`,
                ]),
                mentions: [target, sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to send DM! User may have blocked the bot.*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🔕 AUTOBIO
    // ═══════════════════════════════════════

    if (lower === '.autobio on') {
        await react(sock, jid, msg.key, '✅');
        await db.set('autoBioEnabled', true);
        await sock.sendMessage(jid, {
            text: box('💬 *AUTO BIO ON*', [
                '  ✅ Bio will *auto-update*',
                '  🔄 Updates with news stats',
                `  👮 Changed by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.autobio off') {
        await react(sock, jid, msg.key, '❌');
        await db.set('autoBioEnabled', false);
        await sock.sendMessage(jid, {
            text: box('💬 *AUTO BIO OFF*', [
                '  ❌ Auto bio is *disabled*',
                `  👮 Changed by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    // ═══════════════════════════════════════
    // 🔍 CHECK IF NUMBER IS ON WHATSAPP
    // ═══════════════════════════════════════

    if (lower.startsWith('.check ') || lower.startsWith('check ')) {
        const num = text.replace(/^\.?check\s+/, '').trim().replace(/[^0-9]/g, '');
        if (!num) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.check 94771234567`', '', '  🔍 Check if number is on WhatsApp'])
            });
            return;
        }
        await react(sock, jid, msg.key, '🔍');
        try {
            const result = await sock.onWhatsApp(num);
            const exists = result?.[0]?.exists;
            await sock.sendMessage(jid, {
                text: box('🔍 *WHATSAPP CHECK*', [
                    `  📱 Number: *+${num}*`,
                    exists
                        ? `  ✅ *Registered on WhatsApp*\n  🆔 JID: ${result[0].jid}`
                        : '  ❌ *Not on WhatsApp*',
                    `  👮 Checked by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to check number!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🔒 BLOCK / UNBLOCK USER
    // ═══════════════════════════════════════

    if (lower.startsWith('.block ') || lower.startsWith('block ')) {
        if (!mentioned.length) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.block @user`', '', '  🔒 Blocks a user on WhatsApp'])
            });
            return;
        }
        const target = mentioned[0];
        try {
            await react(sock, jid, msg.key, '🔒');
            await sock.updateBlockStatus(target, 'block');
            await sock.sendMessage(jid, {
                text: box('🔒 *USER BLOCKED*', [
                    `  🔒 @${getSenderNumber(target)} has been *blocked*`,
                    '  🚫 They cannot message the bot',
                    `  👮 By: @${senderMention}`,
                ]),
                mentions: [target, sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to block user!*' });
        }
        return;
    }

    if (lower.startsWith('.unblock ') || lower.startsWith('unblock ')) {
        if (!mentioned.length) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.unblock @user`', '', '  🔓 Unblocks a user on WhatsApp'])
            });
            return;
        }
        const target = mentioned[0];
        try {
            await react(sock, jid, msg.key, '🔓');
            await sock.updateBlockStatus(target, 'unblock');
            await sock.sendMessage(jid, {
                text: box('🔓 *USER UNBLOCKED*', [
                    `  🔓 @${getSenderNumber(target)} has been *unblocked*`,
                    `  👮 By: @${senderMention}`,
                ]),
                mentions: [target, sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to unblock user!*' });
        }
        return;
    }

    if (lower === '.blocklist' || lower === 'blocklist') {
        await react(sock, jid, msg.key, '📋');
        try {
            const list = await sock.fetchBlocklist();
            const lines = list.length
                ? list.map((jid, i) => `  ${i + 1}. +${getSenderNumber(jid)}`)
                : ['  ✅ No blocked users'];
            await sock.sendMessage(jid, {
                text: box(`🔒 *BLOCK LIST (${list.length})*`, [
                    ...lines,
                    '',
                    `  📊 Total blocked: *${list.length}*`,
                ])
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to fetch block list!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🔏 PRIVACY SETTINGS
    // ═══════════════════════════════════════

    if (lower === '.privacy' || lower === 'privacy') {
        await react(sock, jid, msg.key, '🔏');
        try {
            const p = await sock.fetchPrivacySettings(true);
            await sock.sendMessage(jid, {
                text: box('🔏 *PRIVACY SETTINGS*', [
                    `  👁️ Last Seen : *${p.lastSeen || 'all'}*`,
                    `  🟢 Online    : *${p.online || 'all'}*`,
                    `  🖼️ Profile PP: *${p.profilePicture || 'all'}*`,
                    `  📖 Status    : *${p.status || 'all'}*`,
                    `  ✅ Read Rcpts: *${p.readReceipts || 'all'}*`,
                    `  👥 Groups Add: *${p.groupAdd || 'all'}*`,
                    '',
                    '💡 Use `.setprivacy` to change',
                ])
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to fetch privacy settings!*' });
        }
        return;
    }

    if (lower.startsWith('.setprivacy ') || lower.startsWith('setprivacy ')) {
        const args = text.replace(/^\.?setprivacy\s+/, '').trim().toLowerCase().split(' ');
        const type = args[0];
        const value = args[1];

        const types = {
            lastseen: { fn: (v) => sock.updateLastSeenPrivacy(v), values: ['all', 'contacts', 'contact_blacklist', 'none'] },
            online:   { fn: (v) => sock.updateOnlinePrivacy(v),   values: ['all', 'match_last_seen'] },
            pp:       { fn: (v) => sock.updateProfilePicturePrivacy(v), values: ['all', 'contacts', 'contact_blacklist', 'none'] },
            status:   { fn: (v) => sock.updateStatusPrivacy(v),   values: ['all', 'contacts', 'contact_blacklist', 'none'] },
            receipts: { fn: (v) => sock.updateReadReceiptsPrivacy(v), values: ['all', 'none'] },
            groupadd: { fn: (v) => sock.updateGroupsAddPrivacy(v), values: ['all', 'contacts', 'contact_blacklist'] },
        };

        if (!type || !types[type] || !value || !types[type].values.includes(value)) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', [
                    '  📝 `.setprivacy <type> <value>`',
                    '',
                    '  📋 Types & Values:',
                    '  • `lastseen` — all/contacts/contact_blacklist/none',
                    '  • `online`   — all/match_last_seen',
                    '  • `pp`       — all/contacts/contact_blacklist/none',
                    '  • `status`   — all/contacts/contact_blacklist/none',
                    '  • `receipts` — all/none',
                    '  • `groupadd` — all/contacts/contact_blacklist',
                    '',
                    '  💡 Example: `.setprivacy lastseen contacts`',
                ])
            });
            return;
        }
        try {
            await react(sock, jid, msg.key, '🔏');
            await types[type].fn(value);
            await sock.sendMessage(jid, {
                text: box('🔏 *PRIVACY UPDATED*', [
                    `  ✅ *${type}* set to *${value}*`,
                    `  👮 Changed by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to update privacy!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
// 💬 CHAT MODIFY COMMANDS
// ═══════════════════════════════════════

if (lower.startsWith('.archive') || lower.startsWith('archive')) {
    const target = text.replace(/^\.?archive\s*/, '').trim() || jid;
    try {
        await react(sock, jid, msg.key, '📦');
        // requires lastMessages — pass empty array as fallback
        await sock.chatModify({ archive: true, lastMessages: [] }, target);
        await sock.sendMessage(jid, {
            text: box('📦 *CHAT ARCHIVED*', [
                `  📦 Chat archived`,
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to archive!*' }); }
    return;
}

if (lower.startsWith('.unarchive') || lower.startsWith('unarchive')) {
    const target = text.replace(/^\.?unarchive\s*/, '').trim() || jid;
    try {
        await react(sock, jid, msg.key, '📂');
        await sock.chatModify({ archive: false, lastMessages: [] }, target);
        await sock.sendMessage(jid, {
            text: box('📂 *CHAT UNARCHIVED*', [
                `  📂 Chat unarchived`,
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to unarchive!*' }); }
    return;
}

if (lower.startsWith('.mutechat ') || lower.startsWith('mutechat ')) {
    const arg = text.replace(/^\.?mutechat\s+/, '').trim().toLowerCase();
    const durations = { '8h': 28800000, '7d': 604800000, 'off': null };
    const ms = durations[arg];
    if (ms === undefined) {
        await react(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', [
                '  📝 `.mutechat 8h` — 8 hours',
                '  📝 `.mutechat 7d` — 7 days',
                '  📝 `.mutechat off` — Unmute',
            ])
        });
        return;
    }
    try {
        await react(sock, jid, msg.key, ms ? '🔕' : '🔔');
        await sock.chatModify({ mute: ms }, jid);
        await sock.sendMessage(jid, {
            text: box(ms ? '🔕 *CHAT MUTED*' : '🔔 *CHAT UNMUTED*', [
                ms ? `  🔕 Muted for *${arg}*` : '  🔔 Chat unmuted',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
    return;
}

if (lower === '.pinchat' || lower === 'pinchat') {
    try {
        await react(sock, jid, msg.key, '📌');
        await sock.chatModify({ pin: true }, jid);
        await sock.sendMessage(jid, {
            text: box('📌 *CHAT PINNED*', [
                '  📌 This chat is now pinned',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to pin chat!*' }); }
    return;
}

if (lower === '.unpinchat' || lower === 'unpinchat') {
    try {
        await react(sock, jid, msg.key, '📌');
        await sock.chatModify({ pin: false }, jid);
        await sock.sendMessage(jid, {
            text: box('📌 *CHAT UNPINNED*', [
                '  ✅ Chat unpinned',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to unpin chat!*' }); }
    return;
}

if (lower === '.deletechat' || lower === 'deletechat') {
    try {
        await react(sock, jid, msg.key, '🗑️');
        await sock.chatModify({
            delete: true,
            lastMessages: []
        }, jid);
        await sock.sendMessage(jid, {
            text: box('🗑️ *CHAT DELETED*', [
                '  🗑️ Chat removed from list',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to delete chat!*' }); }
    return;
}

// ═══════════════════════════════════════
// ✅ MARK MESSAGES READ
// ═══════════════════════════════════════

if (lower === '.markread' || lower === 'markread') {
    const quotedKey = msg.message?.extendedTextMessage?.contextInfo;
    if (!quotedKey?.stanzaId) {
        await react(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', ['  📝 Reply to a message with `.markread`'])
        });
        return;
    }
    try {
        await react(sock, jid, msg.key, '✅');
        await sock.readMessages([{
            id: quotedKey.stanzaId,
            remoteJid: jid,
            participant: quotedKey.participant,
            fromMe: false
        }]);
        await sock.sendMessage(jid, {
            text: box('✅ *MESSAGE MARKED READ*', [
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
    return;
}

// ═══════════════════════════════════════
// ⭐ STAR / UNSTAR MESSAGE
// ═══════════════════════════════════════

if (lower === '.star' || lower === 'star') {
    const quotedKey = msg.message?.extendedTextMessage?.contextInfo;
    if (!quotedKey?.stanzaId) {
        await react(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', ['  📝 Reply to a message with `.star`'])
        });
        return;
    }
    try {
        await react(sock, jid, msg.key, '⭐');
        await sock.chatModify({
            star: {
                messages: [{ id: quotedKey.stanzaId, fromMe: false }],
                star: true
            }
        }, jid);
        await sock.sendMessage(jid, {
            text: box('⭐ *MESSAGE STARRED*', [`  👮 By: @${senderMention}`]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to star!*' }); }
    return;
}

if (lower === '.unstar' || lower === 'unstar') {
    const quotedKey = msg.message?.extendedTextMessage?.contextInfo;
    if (!quotedKey?.stanzaId) {
        await react(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', ['  📝 Reply to a message with `.unstar`'])
        });
        return;
    }
    try {
        await react(sock, jid, msg.key, '✅');
        await sock.chatModify({
            star: {
                messages: [{ id: quotedKey.stanzaId, fromMe: false }],
                star: false
            }
        }, jid);
        await sock.sendMessage(jid, {
            text: box('✅ *MESSAGE UNSTARRED*', [`  👮 By: @${senderMention}`]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to unstar!*' }); }
    return;
}

// ═══════════════════════════════════════
// 📜 FETCH MESSAGE HISTORY
// ═══════════════════════════════════════

if (lower === '.history' || lower === 'history') {
    try {
        await react(sock, jid, msg.key, '📜');
        // Oldest message needed — use quoted if available
        const quotedKey = msg.message?.extendedTextMessage?.contextInfo;
        if (!quotedKey?.stanzaId) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', [
                    '  📝 Reply to the oldest message with `.history`',
                    '  📜 Fetches up to 50 previous messages',
                    '  💡 Results arrive via messaging-history.set event',
                ])
            });
            return;
        }
        await sock.fetchMessageHistory(50, {
            id: quotedKey.stanzaId,
            remoteJid: jid,
            fromMe: false
        }, Math.floor(Date.now() / 1000));
        await sock.sendMessage(jid, {
            text: box('📜 *HISTORY REQUESTED*', [
                '  ✅ Fetching up to *50 messages*',
                '  💡 Messages arrive via history event',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to fetch history!*' }); }
    return;
}

// ═══════════════════════════════════════
// 👤 GET USER STATUS / PROFILE PICTURE
// ═══════════════════════════════════════

if (lower.startsWith('.getstatus ') || lower.startsWith('getstatus ')) {
    if (!mentioned.length) {
        await react(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', ['  📝 `.getstatus @user`'])
        });
        return;
    }
    try {
        await react(sock, jid, msg.key, '💬');
        const status = await sock.fetchStatus(mentioned[0]);
        await sock.sendMessage(jid, {
            text: box('💬 *USER STATUS*', [
                `  👤 @${getSenderNumber(mentioned[0])}`,
                `  💬 Status: *${status?.status || 'No status'}*`,
                `  ⏰ Set: ${status?.setAt ? new Date(status.setAt).toLocaleString() : 'Unknown'}`,
            ]),
            mentions: [mentioned[0]]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to fetch status!*' }); }
    return;
}

if (lower.startsWith('.getpp ') || lower.startsWith('getpp ')) {
    if (!mentioned.length) {
        await react(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', ['  📝 `.getpp @user`'])
        });
        return;
    }
    try {
        await react(sock, jid, msg.key, '🖼️');
        const ppUrl = await sock.profilePictureUrl(mentioned[0], 'image');
        await sock.sendMessage(jid, {
            image: { url: ppUrl },
            caption: box('🖼️ *PROFILE PICTURE*', [
                `  👤 @${getSenderNumber(mentioned[0])}`,
                `  👮 Requested by: @${senderMention}`,
            ]),
            mentions: [mentioned[0], sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *No profile picture or failed to fetch!*' }); }
    return;
}

// ═══════════════════════════════════════
// 🏢 BUSINESS PROFILE
// ═══════════════════════════════════════

if (lower.startsWith('.bizprofile ') || lower.startsWith('bizprofile ')) {
    if (!mentioned.length) {
        await react(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', ['  📝 `.bizprofile @user`'])
        });
        return;
    }
    try {
        await react(sock, jid, msg.key, '🏢');
        const profile = await sock.getBusinessProfile(mentioned[0]);
        await sock.sendMessage(jid, {
            text: box('🏢 *BUSINESS PROFILE*', [
                `  👤 @${getSenderNumber(mentioned[0])}`,
                `  📝 Desc: ${profile?.description || 'None'}`,
                `  🏷️ Category: ${profile?.category || 'None'}`,
                `  🌐 Website: ${profile?.website?.[0] || 'None'}`,
                `  📧 Email: ${profile?.email || 'None'}`,
            ]),
            mentions: [mentioned[0]]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Not a business account or failed!*' }); }
    return;
}

// ═══════════════════════════════════════
// 🟢 SUBSCRIBE TO PRESENCE
// ═══════════════════════════════════════

if (lower.startsWith('.subscribe ') || lower.startsWith('subscribe ')) {
    if (!mentioned.length) {
        await react(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', ['  📝 `.subscribe @user`', '  🟢 Watch their online/typing status'])
        });
        return;
    }
    try {
        await react(sock, jid, msg.key, '🟢');
        await sock.presenceSubscribe(mentioned[0]);
        await sock.sendMessage(jid, {
            text: box('🟢 *PRESENCE SUBSCRIBED*', [
                `  👤 Now watching @${getSenderNumber(mentioned[0])}`,
                '  🟢 Online/typing updates enabled',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [mentioned[0], sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to subscribe!*' }); }
    return;
}

// ═══════════════════════════════════════
// 📢 POST STATUS (STORY)
// ═══════════════════════════════════════

if (lower.startsWith('.poststatus ') || lower.startsWith('poststatus ')) {
    const statusText = text.replace(/^\.?poststatus\s+/, '').trim();
    if (!statusText) {
        await react(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', [
                '  📝 `.poststatus Your status text`',
                '  📢 Posts to your WhatsApp Story',
            ])
        });
        return;
    }
    try {
        await react(sock, jid, msg.key, '📢');
        // Get all contacts for statusJidList
        const groups = await sock.groupFetchAllParticipating();
        const statusJidList = Object.values(groups)
            .flatMap(g => g.participants.map(p => p.id))
            .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

        await sock.sendMessage('status@broadcast', {
            text: statusText
        }, {
            broadcast: true,
            statusJidList
        });
        await sock.sendMessage(jid, {
            text: box('📢 *STATUS POSTED*', [
                `  ✅ Story posted successfully`,
                `  📝 Content: "${statusText.substring(0, 50)}${statusText.length > 50 ? '...' : ''}"`,
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to post status!*' }); }
    return;
}

// ═══════════════════════════════════════
// 📋 BROADCAST LIST INFO
// ═══════════════════════════════════════

if (lower.startsWith('.broadcastinfo ') || lower.startsWith('broadcastinfo ')) {
    const blistJid = text.replace(/^\.?broadcastinfo\s+/, '').trim();
    if (!blistJid) {
        await react(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', [
                '  📝 `.broadcastinfo 1234567890@broadcast`',
                '  📋 Get broadcast list name & recipients',
            ])
        });
        return;
    }
    try {
        await react(sock, jid, msg.key, '📋');
        const bList = await sock.getBroadcastListInfo(blistJid);
        await sock.sendMessage(jid, {
            text: box('📋 *BROADCAST LIST INFO*', [
                `  📛 Name: *${bList.name}*`,
                `  👥 Recipients: *${bList.recipients?.length || 0}*`,
                `  🆔 JID: ${blistJid}`,
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to fetch broadcast list info!*' }); }
    return;
}
    
    // ═══════════════════════════════════════
    // ⏳ DEFAULT DISAPPEARING MESSAGES
    // ═══════════════════════════════════════

    if (lower.startsWith('.defaultdisappear ') || lower.startsWith('defaultdisappear ')) {
        const arg = text.replace(/^\.?defaultdisappear\s+/, '').trim().toLowerCase();
        const durations = { '24h': 86400, '7d': 604800, '90d': 7776000, 'off': 0 };
        const secs = durations[arg];
        if (secs === undefined) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', [
                    '  📝 `.defaultdisappear <duration>`',
                    '',
                    '  ⏳ Options: 24h / 7d / 90d / off',
                    '  💡 Sets default for *new chats only*',
                ])
            });
            return;
        }
        try {
            await react(sock, jid, msg.key, secs === 0 ? '❌' : '⏳');
            await sock.updateDefaultDisappearingMode(secs);
            await sock.sendMessage(jid, {
                text: box('⏳ *DEFAULT DISAPPEARING MODE*', [
                    secs === 0
                        ? '  ❌ Disabled for new chats'
                        : `  ✅ New chats will disappear after *${arg}*`,
                    '  💡 Applies to new chats only',
                    `  👮 Changed by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to update disappearing mode!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🟢 PRESENCE / ONLINE STATUS
    // ═══════════════════════════════════════

    if (lower.startsWith('.presence ') || lower.startsWith('presence ')) {
        const arg = text.replace(/^\.?presence\s+/, '').trim().toLowerCase();
        const valid = ['available', 'unavailable', 'composing', 'recording', 'paused'];
        if (!valid.includes(arg)) {
            await react(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', [
                    '  📝 `.presence <status>`',
                    '',
                    '  🟢 Options:',
                    '  • `available`   — Online',
                    '  • `unavailable` — Offline',
                    '  • `composing`   — Typing...',
                    '  • `recording`   — Recording...',
                    '  • `paused`      — Stopped typing',
                ])
            });
            return;
        }
        try {
            await react(sock, jid, msg.key, '🟢');
            await sock.sendPresenceUpdate(arg);
            await sock.sendMessage(jid, {
                text: box('🟢 *PRESENCE UPDATED*', [
                    `  ✅ Status set to *${arg}*`,
                    `  👮 Changed by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to update presence!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 📊 OWNER HELP
    // ═══════════════════════════════════════

    if (lower === '.ownerhelp' || lower === 'ownerhelp' || lower === '.oh') {
        await react(sock, jid, msg.key, '👑');
        await sock.sendMessage(jid, {
            text: box('👑 *OWNER COMMANDS*', [
                divider('🌍 Bot Control'),
                '  🌍 `.mode public/private/inbox/groups`',
                '  🔄 `.restart`       — Restart bot',
                '  🚪 `.logout`        — Logout bot',
                '  📊 `.botstats`      — Full statistics',
                '  🔧 `.setprefix !`   — Change prefix',
                '',
                divider('📰 News'),
                '  📰 `.autonews on/off`',
                '  🗑️ `.clearnews`     — Clear cache',
                '',
                divider('🖤 Status'),
                '  🖤 `.autostatus on/off`',
                '  💾 `.autostatussave on/off`',
                '  💬 `.autobio on/off`',
                '',
                divider('🚫 Ban System'),
                '  🚫 `.ban @user reason`',
                '  ✅ `.unban @user`',
                '  📋 `.banlist`',
                '',
                divider('🔒 Block System'),
                '  🔒 `.block @user`',
                '  🔓 `.unblock @user`',
                '  📋 `.blocklist`',
                '',
                divider('🔏 Privacy'),
                '  🔏 `.privacy`       — View settings',
                '  🔏 `.setprivacy <type> <value>`',
                '  ⏳ `.defaultdisappear 24h/7d/90d/off`',
                '',
                divider('🟢 Presence'),
                '  🟢 `.presence available/unavailable`',
                '  🟢 `.presence composing/recording`',
                '',
                divider('📢 Broadcast'),
                '  📢 `.broadcast message`',
                '  📨 `.dm @user message`',
                '',
                divider('🤖 Profile'),
                '  📝 `.setbotname Name`',
                '  💬 `.setbio Bio text`',
                '  📸 `.setpp`         — Reply to image',
                '  🗑️ `.removepp`      — Remove picture',
                '',
                divider('📋 Groups & Utils'),
                '  📋 `.groups`        — List all groups',
                '  🔍 `.findgroup name`— Search groups',
                '  🔍 `.check number`  — Check WhatsApp',
            ])
        });
        return;
    }
}

// ═══════════════════════════════════════════════════════
// ⚙️ SETTINGS COMMAND
// ═══════════════════════════════════════════════════════

async function handleSettingsCommand(sock, jid, db, isOwner, config) {
    await sendSettingsMenu(sock, jid, db, isOwner, config);
}

// ═══════════════════════════════════════════════════════
// 🔌 CONNECTED MESSAGE
// ═══════════════════════════════════════════════════════

async function sendConnectedMessage(sock, db, config) {
    const ownerJid = sock.user?.id?.replace(/:.*/, '') + '@s.whatsapp.net';
    if (!ownerJid) return;
    await new Promise(r => setTimeout(r, 3000));
    try {
        const bn = sock.user?.id?.split('@')[0] || 'Unknown';
        const ve = await db.get('voiceReplyEnabled', true);
        const mode = await db.get('botMode', 'public');
        const urlCount = await db.urlsCount();

        const msgText = [
            '╔' + '═'.repeat(38) + '╗',
            '║     💝 *NEWS BOT LK* 💝        ║',
            '║   🦄 *Successfully Connected!* 🦄 ║',
            '╚' + '═'.repeat(38) + '╝',
            '',
            `  ✅ *Status:* Online`,
            `  🆔 *Number:* ${bn}`,
            `  ${MODE_EMOJIS[mode]} *Mode:* ${mode.toUpperCase()}`,
            `  🎵 *Voice:* ${ve ? 'ON' : 'OFF'}`,
            `  📰 *News Tracked:* ${urlCount}`,
            '',
            divider('📋 Quick Commands'),
            '  📰 `.news`      — Fetch news',
            '  📋 `.menu`      — Show menu',
            '  ⚙️ `.settings`  — Bot settings',
            '  📊 `.botstats`  — Statistics',
            '  👑 `.ownerhelp` — Owner commands',
            '',
            '💝 *Umesha | Mithila | Sharada*',
            '',
            footer()
        ].join('\n');

        try {
            const lr = await axios.get(config.botLogo, { responseType: 'arraybuffer', timeout: 10000 });
            if (lr.data?.length > 1000) {
                await sock.sendMessage(ownerJid, { image: Buffer.from(lr.data), caption: msgText, mimetype: 'image/png' });
            } else {
                await sock.sendMessage(ownerJid, { text: msgText });
            }
        } catch {
            await sock.sendMessage(ownerJid, { text: msgText });
        }
    } catch {}
}

module.exports = { handleOwnerCommands, handleSettingsCommand, sendConnectedMessage };
