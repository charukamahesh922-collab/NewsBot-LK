// ═══════════════════════════════════════════════════════
// 🎨 HELPERS
// ═══════════════════════════════════════════════════════

const { jidDecode, jidNormalizedUser } = require('@whiskeysockets/baileys');

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

// React to the INCOMING command message (not the bot reply)
const reactCmd = async (sock, jid, key, emoji) => {
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

const divider = (title) => `┄`.repeat(10) + ` ${title} ` + `┄`.repeat(10);
const toggle = (enabled) => enabled ? '✅ *ON*' : '❌ *OFF*';

// ═══════════════════════════════════════════════════════
// 🛡️ ADMIN COMMANDS HANDLER
// ═══════════════════════════════════════════════════════

async function handleAdminCommands(sock, msg, jid, text, lower, sender, db) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const senderNum = getSenderNumber(sender);
    const senderMention = getSenderMention(sender);

    // ═══════════════════════════════════════
    // 🔇 MUTE / UNMUTE
    // ═══════════════════════════════════════

    if (lower === '.mute' || lower === 'mute') {
        await reactCmd(sock, jid, msg.key, '🔇');
        await db.groupSet(jid, 'isMuted', true);
        await sock.sendMessage(jid, {
            text: box('🔇 *GROUP MUTED*', [
                `  🔇 Group muted for *30 minutes*`,
                `  👮 By: @${senderMention}`,
                `  ⏰ Auto-unmute at: ${new Date(Date.now() + 1800000).toLocaleTimeString()}`,
                '',
                '  💬 Only admins can send messages',
            ]),
            mentions: [sender]
        });
        setTimeout(async () => {
            await db.groupSet(jid, 'isMuted', false);
            await sock.sendMessage(jid, {
                text: box('🔊 *AUTO UNMUTED*', [
                    '  ✅ 30 minutes passed',
                    '  🔊 Group is now open!',
                    '',
                    '  💬 Everyone can send messages again',
                ])
            });
        }, 1800000);
        return;
    }

    if (lower.startsWith('.mute ') || lower.startsWith('mute ')) {
        const mins = parseInt(text.replace(/^\.?mute\s+/, '').trim()) || 30;
        const ms = mins * 60 * 1000;
        await reactCmd(sock, jid, msg.key, '🔇');
        await db.groupSet(jid, 'isMuted', true);
        await sock.sendMessage(jid, {
            text: box('🔇 *GROUP MUTED*', [
                `  🔇 Group muted for *${mins} minutes*`,
                `  👮 By: @${senderMention}`,
                `  ⏰ Auto-unmute at: ${new Date(Date.now() + ms).toLocaleTimeString()}`,
                '',
                '  💬 Only admins can send messages',
            ]),
            mentions: [sender]
        });
        setTimeout(async () => {
            await db.groupSet(jid, 'isMuted', false);
            await sock.sendMessage(jid, {
                text: box('🔊 *AUTO UNMUTED*', [
                    `  ✅ ${mins} minutes passed`,
                    '  🔊 Group is now open!',
                    '',
                    '  💬 Everyone can send messages again',
                ])
            });
        }, ms);
        return;
    }

    if (lower === '.unmute' || lower === 'unmute') {
        await reactCmd(sock, jid, msg.key, '🔊');
        await db.groupSet(jid, 'isMuted', false);
        await sock.sendMessage(jid, {
            text: box('🔊 *GROUP UNMUTED*', [
                '  🔊 Everyone can send messages',
                `  👮 By: @${senderMention}`,
                `  ⏰ ${new Date().toLocaleString()}`,
                '',
                '  💬 Chat is now open for everyone',
            ]),
            mentions: [sender]
        });
        return;
    }

    // ═══════════════════════════════════════
    // ⚠️ WARN SYSTEM
    // ═══════════════════════════════════════

    if (lower.startsWith('.warn ') || lower.startsWith('warn ')) {
        if (!mentioned.length) {
            await reactCmd(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', [
                    '  📝 `.warn @user [reason]`',
                    '',
                    '  ⚠️ Issues a warning to a user',
                    '  🚫 3 warnings = auto-kick',
                ])
            });
            return;
        }
        const target = mentioned[0];
        const reason = text.replace(/^\.?warn\s+@\S+\s*/, '').trim() || 'No reason given';
        const count = await db.warnAdd(target, jid);
        const bars = '🟡'.repeat(count) + '⚪'.repeat(3 - count);
        const targetNum = getSenderNumber(target);
        await reactCmd(sock, jid, msg.key, count >= 3 ? '🚫' : '⚠️');
        await sock.sendMessage(jid, {
            text: box('⚠️ *WARNING ISSUED*', [
                `  👤 User: @${targetNum}`,
                `  📝 Reason: *${reason}*`,
                `  ⚠️ Warnings: *${count}/3*`,
                `  ${bars}`,
                '',
                count >= 3
                    ? '  🚫 *Max reached! Removing from group...*'
                    : `  💡 *${3 - count} warning(s) left before kick*`,
                '',
                `  👮 By: @${senderMention}`,
                `  ⏰ ${new Date().toLocaleString()}`,
            ]),
            mentions: [target, sender]
        });
        if (count >= 3) {
            try {
                await sock.groupParticipantsUpdate(jid, [target], 'remove');
                await db.warnClear(target, jid);
            } catch {}
        }
        return;
    }

    if (lower.startsWith('.clearwarn ') || lower.startsWith('clearwarn ')) {
        if (!mentioned.length) {
            await reactCmd(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.clearwarn @user`', '', '  ✅ Clears all warnings for a user'])
            });
            return;
        }
        const target = mentioned[0];
        await db.warnClear(target, jid);
        const targetNum = getSenderNumber(target);
        await reactCmd(sock, jid, msg.key, '✅');
        await sock.sendMessage(jid, {
            text: box('✅ *WARNINGS CLEARED*', [
                `  👤 @${targetNum}'s warnings have been reset`,
                '  ⚪⚪⚪ *0/3*',
                '',
                `  👮 By: @${senderMention}`,
                `  ⏰ ${new Date().toLocaleString()}`,
            ]),
            mentions: [target, sender]
        });
        return;
    }

    if (lower.startsWith('.warnlist') || lower.startsWith('warnlist')) {
        await reactCmd(sock, jid, msg.key, '📋');
        try {
            const m = await sock.groupMetadata(jid);
            const warnLines = [];
            for (const p of m.participants) {
                const count = await db.warnGet ? await db.warnGet(p.id, jid) : 0;
                if (count > 0) {
                    warnLines.push(`  ⚠️ @${getSenderNumber(p.id)}: *${count}/3*`);
                }
            }
            await sock.sendMessage(jid, {
                text: box('📋 *WARN LIST*',
                    warnLines.length
                        ? [...warnLines, '', `  📊 Total warned: *${warnLines.length}*`]
                        : ['  ✅ No warnings issued']
                )
            });
        } catch {}
        return;
    }

    // ═══════════════════════════════════════
    // 🚫 KICK / ADD
    // ═══════════════════════════════════════

    if (lower.startsWith('.kick ') || lower.startsWith('kick ')) {
        if (!mentioned.length) {
            await reactCmd(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.kick @user`', '', '  🚫 Removes a member from the group'])
            });
            return;
        }
        const target = mentioned[0];
        const targetNum = getSenderNumber(target);
        try {
            await reactCmd(sock, jid, msg.key, '🚫');
            await sock.sendMessage(jid, {
                text: box('🚫 *MEMBER KICKED*', [
                    `  👤 @${targetNum} has been removed`,
                    `  👮 By: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [target, sender]
            });
            await sock.groupParticipantsUpdate(jid, [target], 'remove');
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to kick! User may be an admin.*' });
        }
        return;
    }

    if (lower.startsWith('.add ') || lower.startsWith('add ')) {
        const num = text.replace(/^\.?add\s+/, '').trim().replace(/[^0-9]/g, '');
        if (!num) {
            await reactCmd(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.add 947xxxxxxxxx`', '', '  📱 Example: `.add 94771234567`'])
            });
            return;
        }
        try {
            await reactCmd(sock, jid, msg.key, '✅');
            await sock.groupParticipantsUpdate(jid, [num + '@s.whatsapp.net'], 'add');
            await sock.sendMessage(jid, {
                text: box('✅ *MEMBER ADDED*', [
                    `  📱 Number: *+${num}*`,
                    `  👮 Added by: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                    '',
                    '  🎉 Welcome to the group!',
                ]),
                mentions: [sender]
            });
        } catch {
            await reactCmd(sock, jid, msg.key, '❌');
            await sock.sendMessage(jid, {
                text: box('❌ *ADD FAILED*', [
                    '  ❌ User may not be on WhatsApp',
                    '  ❌ Group may be full',
                    '  ❌ Invalid phone number',
                ])
            });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 👑 PROMOTE / DEMOTE
    // ═══════════════════════════════════════

    if (lower.startsWith('.promote ') || lower.startsWith('promote ')) {
        if (!mentioned.length) {
            await reactCmd(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.promote @user`', '', '  👑 Makes a member an admin'])
            });
            return;
        }
        const target = mentioned[0];
        try {
            await reactCmd(sock, jid, msg.key, '👑');
            await sock.groupParticipantsUpdate(jid, [target], 'promote');
            await sock.sendMessage(jid, {
                text: box('👑 *MEMBER PROMOTED*', [
                    `  🌟 @${getSenderNumber(target)} is now an *Admin*`,
                    `  👮 Promoted by: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                    '',
                    '  🎉 Congratulations!',
                ]),
                mentions: [target, sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to promote!*' });
        }
        return;
    }

    if (lower.startsWith('.demote ') || lower.startsWith('demote ')) {
        if (!mentioned.length) {
            await reactCmd(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.demote @user`', '', '  ⬇️ Removes admin status'])
            });
            return;
        }
        const target = mentioned[0];
        try {
            await reactCmd(sock, jid, msg.key, '⬇️');
            await sock.groupParticipantsUpdate(jid, [target], 'demote');
            await sock.sendMessage(jid, {
                text: box('⬇️ *MEMBER DEMOTED*', [
                    `  👤 @${getSenderNumber(target)} is no longer an Admin`,
                    `  👮 Demoted by: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [target, sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to demote!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // ✏️ GROUP SUBJECT / DESCRIPTION
    // ═══════════════════════════════════════

    if (lower.startsWith('.setname ') || lower.startsWith('setname ')) {
        const newName = text.replace(/^\.?setname\s+/, '').trim();
        if (!newName) {
            await reactCmd(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.setname New Group Name`'])
            });
            return;
        }
        try {
            await reactCmd(sock, jid, msg.key, '✏️');
            await sock.groupUpdateSubject(jid, newName);
            await sock.sendMessage(jid, {
                text: box('✏️ *GROUP NAME UPDATED*', [
                    `  📛 New name: *${newName}*`,
                    `  👮 By: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to update group name!*' });
        }
        return;
    }

    if (lower.startsWith('.setdesc ') || lower.startsWith('setdesc ')) {
        const newDesc = text.replace(/^\.?setdesc\s+/, '').trim();
        if (!newDesc) {
            await reactCmd(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.setdesc New description here`'])
            });
            return;
        }
        try {
            await reactCmd(sock, jid, msg.key, '📝');
            await sock.groupUpdateDescription(jid, newDesc);
            await sock.sendMessage(jid, {
                text: box('📝 *GROUP DESCRIPTION UPDATED*', [
                    `  📄 New desc: *${newDesc}*`,
                    `  👮 By: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to update description!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🔒 GROUP SETTINGS (lock/unlock/open/close)
    // ═══════════════════════════════════════

    if (lower === '.lock' || lower === 'lock') {
        // Only admins can change group settings
        await reactCmd(sock, jid, msg.key, '🔒');
        try {
            await sock.groupSettingUpdate(jid, 'locked');
            await sock.sendMessage(jid, {
                text: box('🔒 *GROUP LOCKED*', [
                    '  🔒 Only admins can change group settings',
                    `  👮 By: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to lock group settings!*' });
        }
        return;
    }

    if (lower === '.unlock' || lower === 'unlock') {
        await reactCmd(sock, jid, msg.key, '🔓');
        try {
            await sock.groupSettingUpdate(jid, 'unlocked');
            await sock.sendMessage(jid, {
                text: box('🔓 *GROUP UNLOCKED*', [
                    '  🔓 All members can change group settings',
                    `  👮 By: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to unlock group settings!*' });
        }
        return;
    }

    if (lower === '.open' || lower === 'open') {
        // Allow everyone to send messages
        await reactCmd(sock, jid, msg.key, '🟢');
        try {
            await sock.groupSettingUpdate(jid, 'not_announcement');
            await sock.sendMessage(jid, {
                text: box('🟢 *GROUP OPENED*', [
                    '  💬 All members can send messages',
                    `  👮 By: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to open group!*' });
        }
        return;
    }

    if (lower === '.close' || lower === 'close') {
        // Only admins can send messages
        await reactCmd(sock, jid, msg.key, '🔴');
        try {
            await sock.groupSettingUpdate(jid, 'announcement');
            await sock.sendMessage(jid, {
                text: box('🔴 *GROUP CLOSED*', [
                    '  🔕 Only admins can send messages',
                    `  👮 By: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to close group!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🔗 INVITE LINK
    // ═══════════════════════════════════════

    if (lower === '.invitelink' || lower === '.invite' || lower === 'invitelink') {
        await reactCmd(sock, jid, msg.key, '🔗');
        try {
            const code = await sock.groupInviteCode(jid);
            const link = 'https://chat.whatsapp.com/' + code;
            await sock.sendMessage(jid, {
                text: box('🔗 *GROUP INVITE LINK*', [
                    `  🔗 ${link}`,
                    '',
                    `  👮 Requested by: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to get invite link!*' });
        }
        return;
    }

    if (lower === '.revokeinvite' || lower === '.resetlink' || lower === 'revokeinvite') {
        await reactCmd(sock, jid, msg.key, '🔄');
        try {
            const code = await sock.groupRevokeInvite(jid);
            const link = 'https://chat.whatsapp.com/' + code;
            await sock.sendMessage(jid, {
                text: box('🔄 *INVITE LINK REVOKED*', [
                    '  ♻️ Old link is now invalid',
                    `  🔗 New link: ${link}`,
                    '',
                    `  👮 By: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to revoke invite link!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // ⏳ DISAPPEARING MESSAGES
    // ═══════════════════════════════════════

    if (lower.startsWith('.disappear ') || lower.startsWith('disappear ')) {
        const arg = text.replace(/^\.?disappear\s+/, '').trim().toLowerCase();
        const durations = { '24h': 86400, '7d': 604800, '90d': 7776000, 'off': 0 };
        const secs = durations[arg];
        if (secs === undefined) {
            await reactCmd(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', [
                    '  📝 `.disappear <duration>`',
                    '',
                    '  ⏳ Options:',
                    '  • `.disappear 24h`  — 24 hours',
                    '  • `.disappear 7d`   — 7 days',
                    '  • `.disappear 90d`  — 90 days',
                    '  • `.disappear off`  — Disable',
                ])
            });
            return;
        }
        try {
            await reactCmd(sock, jid, msg.key, secs === 0 ? '❌' : '⏳');
            await sock.groupToggleEphemeral(jid, secs);
            await sock.sendMessage(jid, {
                text: box('⏳ *DISAPPEARING MESSAGES*', [
                    secs === 0
                        ? '  ❌ Disappearing messages *disabled*'
                        : `  ✅ Messages disappear after *${arg}*`,
                    '',
                    `  👮 By: @${senderMention}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to update disappearing messages!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 👥 MEMBER ADD MODE
    // ═══════════════════════════════════════

    if (lower === '.memberadd on' || lower === 'memberadd on') {
        await reactCmd(sock, jid, msg.key, '✅');
        try {
            await sock.groupMemberAddMode(jid, 'all_member_add');
            await sock.sendMessage(jid, {
                text: box('👥 *MEMBER ADD: ALL*', [
                    '  ✅ All members can add participants',
                    `  👮 By: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed!*' });
        }
        return;
    }

    if (lower === '.memberadd off' || lower === 'memberadd off') {
        await reactCmd(sock, jid, msg.key, '❌');
        try {
            await sock.groupMemberAddMode(jid, 'admin_add');
            await sock.sendMessage(jid, {
                text: box('👥 *MEMBER ADD: ADMIN ONLY*', [
                    '  🔒 Only admins can add participants',
                    `  👮 By: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 📋 JOIN REQUESTS
    // ═══════════════════════════════════════

    if (lower === '.joinrequests' || lower === 'joinrequests') {
        await reactCmd(sock, jid, msg.key, '📋');
        try {
            const requests = await sock.groupRequestParticipantsList(jid);
            const lines = requests.length
                ? requests.map((r, i) => `  ${i + 1}. +${getSenderNumber(r.jid)}`)
                : ['  ✅ No pending join requests'];
            await sock.sendMessage(jid, {
                text: box('📋 *PENDING JOIN REQUESTS*', [
                    ...lines,
                    '',
                    `  📊 Total: *${requests.length}*`,
                    `  💡 Use .approveall or .rejectall`,
                ])
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to fetch join requests!*' });
        }
        return;
    }

    if (lower === '.approveall' || lower === 'approveall') {
        await reactCmd(sock, jid, msg.key, '✅');
        try {
            const requests = await sock.groupRequestParticipantsList(jid);
            if (!requests.length) {
                await sock.sendMessage(jid, { text: '✅ *No pending join requests.*' });
                return;
            }
            await sock.groupRequestParticipantsUpdate(jid, requests.map(r => r.jid), 'approve');
            await sock.sendMessage(jid, {
                text: box('✅ *ALL REQUESTS APPROVED*', [
                    `  👥 Approved *${requests.length}* request(s)`,
                    `  👮 By: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to approve requests!*' });
        }
        return;
    }

    if (lower === '.rejectall' || lower === 'rejectall') {
        await reactCmd(sock, jid, msg.key, '🚫');
        try {
            const requests = await sock.groupRequestParticipantsList(jid);
            if (!requests.length) {
                await sock.sendMessage(jid, { text: '✅ *No pending join requests.*' });
                return;
            }
            await sock.groupRequestParticipantsUpdate(jid, requests.map(r => r.jid), 'reject');
            await sock.sendMessage(jid, {
                text: box('🚫 *ALL REQUESTS REJECTED*', [
                    `  ❌ Rejected *${requests.length}* request(s)`,
                    `  👮 By: @${senderMention}`,
                ]),
                mentions: [sender]
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to reject requests!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 📊 GROUP INFO
    // ═══════════════════════════════════════

    if (lower === '.groupinfo' || lower === '.ginfo' || lower === 'groupinfo') {
        await reactCmd(sock, jid, msg.key, '📊');
        try {
            const meta = await sock.groupMetadata(jid);
            const admins = meta.participants.filter(p => p.admin).length;
            await sock.sendMessage(jid, {
                text: box('📊 *GROUP INFO*', [
                    `  📛 Name: *${meta.subject}*`,
                    `  🆔 JID: \`${meta.id}\``,
                    `  📄 Desc: ${meta.desc || 'None'}`,
                    `  👥 Members: *${meta.participants.length}*`,
                    `  👑 Admins: *${admins}*`,
                    `  🔒 Announce: ${toggle(meta.announce)}`,
                    `  🔐 Restrict: ${toggle(meta.restrict)}`,
                    `  ⏳ Ephemeral: ${meta.ephemeralDuration ? meta.ephemeralDuration + 's' : 'Off'}`,
                    `  ⏰ ${new Date().toLocaleString()}`,
                ])
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to fetch group info!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 👥 MEMBER LIST
    // ═══════════════════════════════════════

    if (lower === '.members' || lower === '.memberlist' || lower === 'members') {
        await reactCmd(sock, jid, msg.key, '👥');
        try {
            const meta = await sock.groupMetadata(jid);
            const lines = meta.participants.map((p, i) => {
                const icon = p.admin === 'superadmin' ? '👑' : p.admin ? '⭐' : '👤';
                return `  ${icon} ${i + 1}. +${getSenderNumber(p.id)}`;
            });
            await sock.sendMessage(jid, {
                text: box(`👥 *MEMBERS (${meta.participants.length})*`, [
                    ...lines.slice(0, 50), // cap at 50 to avoid huge messages
                    ...(lines.length > 50 ? [`  ... and ${lines.length - 50} more`] : []),
                    '',
                    '  👑 = Owner  ⭐ = Admin  👤 = Member',
                ])
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to fetch member list!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🔗 ANTI-LINK
    // ═══════════════════════════════════════

    if (lower === '.antilink on') {
        await reactCmd(sock, jid, msg.key, '✅');
        await db.set('antiLinkEnabled', true);
        await sock.sendMessage(jid, {
            text: box('🔗 *ANTI-LINK ENABLED*', [
                '  ✅ Links will be *auto-deleted*',
                '  🛡️ Members cannot share links',
                '  👑 Admins are exempt',
                '',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.antilink off') {
        await reactCmd(sock, jid, msg.key, '❌');
        await db.set('antiLinkEnabled', false);
        await sock.sendMessage(jid, {
            text: box('🔗 *ANTI-LINK DISABLED*', [
                '  ❌ Link protection is *OFF*',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    // ═══════════════════════════════════════
    // 🚫 ANTI-BAD WORD
    // ═══════════════════════════════════════

    if (lower === '.antibadword on') {
        await reactCmd(sock, jid, msg.key, '✅');
        await db.set('antiBadWordEnabled', true);
        await sock.sendMessage(jid, {
            text: box('🚫 *ANTI-BAD WORD ON*', [
                '  ✅ Bad words will be *auto-deleted*',
                '  ⚠️ Users will be warned',
                '  👑 Admins are exempt',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.antibadword off') {
        await reactCmd(sock, jid, msg.key, '❌');
        await db.set('antiBadWordEnabled', false);
        await sock.sendMessage(jid, {
            text: box('🚫 *ANTI-BAD WORD OFF*', [
                '  ❌ Bad word filter is *OFF*',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    // ═══════════════════════════════════════
    // 👋 WELCOME / GOODBYE
    // ═══════════════════════════════════════

    if (lower === '.welcome on') {
        await reactCmd(sock, jid, msg.key, '✅');
        await db.set('welcomeEnabled', true);
        await sock.sendMessage(jid, {
            text: box('👋 *WELCOME ENABLED*', [
                '  ✅ New members will be *welcomed*',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.welcome off') {
        await reactCmd(sock, jid, msg.key, '❌');
        await db.set('welcomeEnabled', false);
        await sock.sendMessage(jid, {
            text: box('👋 *WELCOME DISABLED*', [
                '  ❌ Welcome messages are *OFF*',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.goodbye on') {
        await reactCmd(sock, jid, msg.key, '✅');
        await db.set('goodbyeEnabled', true);
        await sock.sendMessage(jid, {
            text: box('👋 *GOODBYE ENABLED*', [
                '  ✅ Leaving members get *goodbye*',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.goodbye off') {
        await reactCmd(sock, jid, msg.key, '❌');
        await db.set('goodbyeEnabled', false);
        await sock.sendMessage(jid, {
            text: box('👋 *GOODBYE DISABLED*', [
                '  ❌ Goodbye messages are *OFF*',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    // ═══════════════════════════════════════
    // 🎵 VOICE REPLIES
    // ═══════════════════════════════════════

    if (lower === '.voice on') {
        await reactCmd(sock, jid, msg.key, '✅');
        await db.set('voiceReplyEnabled', true);
        await sock.sendMessage(jid, {
            text: box('🎵 *VOICE REPLIES ON*', [
                '  ✅ Voice replies are *enabled*',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.voice off') {
        await reactCmd(sock, jid, msg.key, '❌');
        await db.set('voiceReplyEnabled', false);
        await sock.sendMessage(jid, {
            text: box('🔇 *VOICE REPLIES OFF*', [
                '  ❌ Voice replies are *disabled*',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    // ═══════════════════════════════════════
    // 🚨 ANTI-SPAM
    // ═══════════════════════════════════════

    if (lower === '.antispam on') {
        await reactCmd(sock, jid, msg.key, '✅');
        await db.set('antiSpamEnabled', true);
        await sock.sendMessage(jid, {
            text: box('🚨 *ANTI-SPAM ON*', [
                '  ✅ Spam detection *enabled*',
                '  🛡️ Spammers will be warned',
                '  🚫 3 warnings = auto-kick',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    if (lower === '.antispam off') {
        await reactCmd(sock, jid, msg.key, '❌');
        await db.set('antiSpamEnabled', false);
        await sock.sendMessage(jid, {
            text: box('🚨 *ANTI-SPAM OFF*', [
                '  ❌ Spam detection *disabled*',
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    // ═══════════════════════════════════════
    // 📌 PIN MESSAGE
    // ═══════════════════════════════════════

    if (lower === '.pin' || lower === 'pin') {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
        if (!quotedMsg) {
            await reactCmd(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📌 Reply to a message with `.pin`'])
            });
            return;
        }
        await reactCmd(sock, jid, msg.key, '📌');
        await sock.sendMessage(jid, {
            text: box('📌 *MESSAGE PINNED*', [
                `  👮 Pinned by: @${senderMention}`,
                `  ⏰ ${new Date().toLocaleString()}`,
            ]),
            mentions: [sender]
        });
        return;
    }

    // ═══════════════════════════════════════
    // 🗑️ DELETE MESSAGE
    // ═══════════════════════════════════════

    if (lower === '.delete' || lower === '.del' || lower === 'delete') {
        const quotedKey = msg.message?.extendedTextMessage?.contextInfo;
        if (!quotedKey?.stanzaId) {
            await reactCmd(sock, jid, msg.key, '❓');
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 Reply to a message with `.delete`'])
            });
            return;
        }
        try {
            await reactCmd(sock, jid, msg.key, '🗑️');
            await sock.sendMessage(jid, {
                delete: {
                    remoteJid: jid,
                    id: quotedKey.stanzaId,
                    participant: quotedKey.participant,
                    fromMe: false
                }
            });
        } catch {
            await sock.sendMessage(jid, { text: '❌ *Failed to delete message!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🔕 SLOWMODE
    // ═══════════════════════════════════════

    if (lower.startsWith('.slowmode ') || lower.startsWith('slowmode ')) {
        const arg = text.replace(/^\.?slowmode\s+/, '').trim().toLowerCase();
        if (arg === 'off') {
            await reactCmd(sock, jid, msg.key, '❌');
            await db.groupSet(jid, 'slowModeEnabled', false);
            await sock.sendMessage(jid, {
                text: box('🐢 *SLOW MODE OFF*', [
                    '  ❌ Slow mode *disabled*',
                    `  👮 By: @${senderMention}`,
                ]),
                mentions: [sender]
            });
            return;
        }
        const secs = parseInt(arg) || 10;
        await reactCmd(sock, jid, msg.key, '🐢');
        await db.groupSet(jid, 'slowMode', secs);
        await db.groupSet(jid, 'slowModeEnabled', true);
        await sock.sendMessage(jid, {
            text: box('🐢 *SLOW MODE ON*', [
                `  ⏱️ Delay: *${secs} seconds*`,
                '  🛡️ Members must wait between messages',
                `  👮 Set by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }
    
    // ═══════════════════════════════════════
// ➕ CREATE GROUP
// ═══════════════════════════════════════
if (lower.startsWith('.creategroup ') || lower.startsWith('creategroup ')) {
    const groupName = text.replace(/^\.?creategroup\s+/, '').trim();
    if (!groupName) {
        await reactCmd(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, { text: box('💡 *USAGE*', ['  📝 `.creategroup Group Name`']) });
        return;
    }
    try {
        await reactCmd(sock, jid, msg.key, '➕');
        const group = await sock.groupCreate(groupName, [sender]);
        await sock.sendMessage(jid, {
            text: box('➕ *GROUP CREATED*', [
                `  📛 Name: *${groupName}*`,
                `  🆔 JID: ${group.id}`,
                `  🔗 https://chat.whatsapp.com/${await sock.groupInviteCode(group.id)}`,
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
// 🚪 LEAVE GROUP
// ═══════════════════════════════════════
if (lower === '.leavegroup' || lower === 'leavegroup') {
    await reactCmd(sock, jid, msg.key, '🚪');
    await sock.sendMessage(jid, {
        text: box('🚪 *LEAVING GROUP*', [
            '  👋 Bot is leaving this group...',
            `  👮 Requested by: @${senderMention}`,
        ]),
        mentions: [sender]
    });
    await sock.groupLeave(jid);
    return;
}

// ═══════════════════════════════════════
// 🔗 JOIN GROUP BY INVITE CODE
// ═══════════════════════════════════════
if (lower.startsWith('.joingroup ') || lower.startsWith('joingroup ')) {
    const code = text.replace(/^\.?joingroup\s+/, '').trim()
        .replace('https://chat.whatsapp.com/', '');
    if (!code) {
        await reactCmd(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, { text: box('💡 *USAGE*', ['  📝 `.joingroup <invite_code>`']) });
        return;
    }
    try {
        await reactCmd(sock, jid, msg.key, '🔗');
        const response = await sock.groupAcceptInvite(code);
        await sock.sendMessage(jid, {
            text: box('✅ *JOINED GROUP*', [
                `  🆔 JID: ${response}`,
                `  👮 By: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch {
        await sock.sendMessage(jid, { text: '❌ *Failed to join! Invalid or expired code.*' });
    }
    return;
}
    
   // ═══════════════════════════════════════
// 🔍 GET GROUP INFO FROM INVITE CODE
// ═══════════════════════════════════════
if (lower.startsWith('.groupinviteinfo ') || lower.startsWith('groupinviteinfo ')) {
    const code = text.replace(/^\.?groupinviteinfo\s+/, '').trim()
        .replace('https://chat.whatsapp.com/', '');
    if (!code) {
        await reactCmd(sock, jid, msg.key, '❓');
        await sock.sendMessage(jid, { text: box('💡 *USAGE*', ['  📝 `.groupinviteinfo <invite_code>`']) });
        return;
    }
    try {
        await reactCmd(sock, jid, msg.key, '🔍');
        const info = await sock.groupGetInviteInfo(code);
        const admins = info.participants?.filter(p => p.admin).length || 0;
        await sock.sendMessage(jid, {
            text: box('🔍 *GROUP INVITE INFO*', [
                `  📛 Name: *${info.subject}*`,
                `  🆔 JID: ${info.id}`,
                `  📄 Desc: ${info.desc || 'None'}`,
                `  👥 Members: *${info.participants?.length || 0}*`,
                `  👑 Admins: *${admins}*`,
                `  👮 Requested by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
    } catch {
        await sock.sendMessage(jid, { text: '❌ *Invalid or expired invite code!*' });
    }
    return;
}

// ═══════════════════════════════════════
// 📨 ACCEPT IN-CHAT GROUP INVITE (V4)
// — place this in your message event handler,
//   not as a text command. Example:
// ═══════════════════════════════════════
// sock.ev.on('messages.upsert', async ({ messages }) => {
//     const msg = messages[0];
//     const groupInvite = msg.message?.groupInviteMessage;
//     if (groupInvite) {
//         const response = await sock.groupAcceptInviteV4(msg.key.remoteJid, groupInvite);
//         console.log('Joined via in-chat invite:', response);
//     }
// });

// ═══════════════════════════════════════
// 📋 FETCH ALL PARTICIPATING GROUPS
// ═══════════════════════════════════════
if (lower === '.mygroups' || lower === 'mygroups') {
    await reactCmd(sock, jid, msg.key, '📋');
    try {
        const groups = await sock.groupFetchAllParticipating();
        const list = Object.values(groups);
        const lines = list.slice(0, 30).map((g, i) => `  ${i + 1}. *${g.subject}*`);
        await sock.sendMessage(jid, {
            text: box(`📋 *MY GROUPS (${list.length})*`, [
                ...lines,
                ...(list.length > 30 ? [`  ... and ${list.length - 30} more`] : []),
            ])
        });
    } catch {
        await sock.sendMessage(jid, { text: '❌ *Failed to fetch groups!*' });
    }
    return;
}

    // ═══════════════════════════════════════
    // 📊 ADMIN SETTINGS STATUS
    // ═══════════════════════════════════════

    if (lower === '.adminsettings' || lower === '.asettings' || lower === 'adminsettings') {
        await reactCmd(sock, jid, msg.key, '⚙️');
        const antiLink  = await db.get('antiLinkEnabled', false);
        const antiBad   = await db.get('antiBadWordEnabled', false);
        const antiSpam  = await db.get('antiSpamEnabled', false);
        const welcome   = await db.get('welcomeEnabled', false);
        const goodbye   = await db.get('goodbyeEnabled', false);
        const voice     = await db.get('voiceReplyEnabled', true);
        const isMuted   = await db.groupGet(jid, 'isMuted', false);
        const slowMode  = await db.groupGet(jid, 'slowModeEnabled', false);

        await sock.sendMessage(jid, {
            text: box('⚙️ *ADMIN SETTINGS*', [
                divider('🛡️ Protection'),
                `  🔗 Anti-Link   : ${toggle(antiLink)}`,
                `  🚫 Anti-BadWord: ${toggle(antiBad)}`,
                `  🚨 Anti-Spam   : ${toggle(antiSpam)}`,
                '',
                divider('👋 Events'),
                `  👋 Welcome  : ${toggle(welcome)}`,
                `  😢 Goodbye  : ${toggle(goodbye)}`,
                '',
                divider('🔧 Other'),
                `  🎵 Voice    : ${toggle(voice)}`,
                `  🔇 Muted    : ${toggle(isMuted)}`,
                `  🐢 SlowMode : ${toggle(slowMode)}`,
                '',
                '💡 Use commands to toggle each setting',
                `  👮 Viewed by: @${senderMention}`,
            ]),
            mentions: [sender]
        });
        return;
    }
}

module.exports = { handleAdminCommands };
