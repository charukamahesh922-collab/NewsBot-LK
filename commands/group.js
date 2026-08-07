const { formatPhoneNumber } = require('../utils/helpers');
const { jidDecode, jidNormalizedUser } = require('@whiskeysockets/baileys');

function getSenderNumber(sender) {
    if (!sender) return 'unknown';
    try {
        const senderStr = String(sender);
        const normalized = jidNormalizedUser(senderStr);
        const decoded = jidDecode(normalized);
        return decoded?.user || 'unknown';
    } catch (e) {
        const str = String(sender);
        const parts = str.split('@');
        return parts[0]?.replace(/[^0-9]/g, '') || 'unknown';
    }
}

function getSenderMention(sender) {
    const num = getSenderNumber(sender);
    return num !== 'unknown' ? num : String(sender).split('@')[0] || 'unknown';
}

const box = (title, lines) => {
    const top = '╭' + '─'.repeat(38) + '╮';
    const mid = '╰' + '─'.repeat(38) + '╯';
    return [top, '┃  ' + title, mid, '', ...lines, ''].join('\n');
};

const divider = (title) => '┄'.repeat(10) + ' ' + title + ' ' + '┄'.repeat(10);
const footer = () => '🦄💝 *NewsBot LK* | Charuka Mahesh';

const react = async (sock, jid, key, emoji) => {
    try { await sock.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
};

async function handleGroupCommands(sock, msg, jid, text, lower, sender, db, isAdmin, isUserOwner) {
    console.log('👥 GROUP CMD:', lower);
    
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const senderNum = getSenderNumber(sender);
    const senderMention = getSenderMention(sender);
    const canManage = isAdmin || isUserOwner;

    // ═══════════════════════════════════════
    // 📋 GROUP INFO
    // ═══════════════════════════════════════

    if (lower === '.admins' || lower === 'admins') {
        try {
            const m = await sock.groupMetadata(jid);
            const ad = m.participants.filter(p => p.admin);
            const lines = ad.map((p, i) => {
                const pNum = getSenderNumber(p.id);
                return `  ${i + 1}. @${pNum} ${p.admin === 'superadmin' ? '👑 *Owner*' : '⭐ *Admin*'}`;
            });
            const sent = await sock.sendMessage(jid, {
                text: box('👑 *GROUP ADMINS*', [
                    ...lines,
                    '',
                    divider('📊 Stats'),
                    `  👑 Admins: *${ad.length}*`,
                    `  👥 Total Members: *${m.participants.length}*`,
                ]),
                mentions: ad.map(p => p.id)
            });
            await react(sock, jid, sent.key, '👑');
        } catch (e) {
            console.error('❌ admins error:', e.message);
            await sock.sendMessage(jid, { text: '❌ *Failed to get admins!*' });
        }
        return;
    }

    if (lower === '.groupinfo' || lower === 'groupinfo' || lower === '.gcinfo' || lower === '.gi') {
        try {
            const m = await sock.groupMetadata(jid);
            const admins = m.participants.filter(p => p.admin).length;
            const created = new Date(m.creation * 1000).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            const sent = await sock.sendMessage(jid, {
                text: box('📋 *GROUP INFO*', [
                    `  📛 *Name:* ${m.subject}`,
                    `  🆔 *JID:* ${jid}`,
                    `  📅 *Created:* ${created}`,
                    '',
                    divider('👥 Members'),
                    `  👥 *Total:* ${m.participants.length}`,
                    `  👑 *Admins:* ${admins}`,
                    `  👤 *Members:* ${m.participants.length - admins}`,
                    '',
                    divider('📝 Description'),
                    `  ${m.desc || 'No description set'}`,
                ])
            });
            await react(sock, jid, sent.key, '📋');
        } catch (e) {
            console.error('❌ groupinfo error:', e.message);
            await sock.sendMessage(jid, { text: '❌ *Failed to get group info!*' });
        }
        return;
    }

    if (lower === '.jid' || lower === 'jid' || lower === '.groupjid') {
        try {
            const m = await sock.groupMetadata(jid);
            const sent = await sock.sendMessage(jid, {
                text: box('🔍 *GROUP JID*', [
                    `  📛 *Name:* ${m.subject}`,
                    `  🆔 *JID:* \`${jid}\``,
                    `  👥 *Members:* ${m.participants.length}`,
                    '',
                    '💡 Copy this JID for bot commands',
                ])
            });
            await react(sock, jid, sent.key, '🔍');
        } catch (e) {
            console.error('❌ jid error:', e.message);
        }
        return;
    }

    // ═══════════════════════════════════════
    // 👥 MEMBER COMMANDS
    // ═══════════════════════════════════════

    if (lower === '.members' || lower === 'members' || lower === '.list') {
        try {
            const m = await sock.groupMetadata(jid);
            const admins = m.participants.filter(p => p.admin);
            const members = m.participants.filter(p => !p.admin);
            const adminList = admins.map(p => `  👑 @${getSenderNumber(p.id)}`).join('\n');
            const memberList = members.map((p, i) => `  ${i + 1}. @${getSenderNumber(p.id)}`).join('\n');
            const sent = await sock.sendMessage(jid, {
                text: box('👥 *MEMBER LIST*', [
                    divider('👑 Admins'),
                    adminList || '  No admins',
                    '',
                    divider('👤 Members'),
                    memberList || '  No members',
                    '',
                    `  📊 Total: *${m.participants.length}*`,
                ]),
                mentions: m.participants.map(p => p.id)
            });
            await react(sock, jid, sent.key, '👥');
        } catch (e) {
            console.error('❌ members error:', e.message);
        }
        return;
    }

    if (lower === '.tagall' || lower === 'tagall' || lower === '.everyone' || lower === '.all') {
        try {
            const m = await sock.groupMetadata(jid);
            const tags = m.participants.map(p => `@${getSenderNumber(p.id)}`).join(' ');
            const sent = await sock.sendMessage(jid, {
                text: box('📢 *ATTENTION EVERYONE!*', [
                    tags,
                    '',
                    `  👮 Called by: @${senderMention}`,
                    `  📅 ${new Date().toLocaleString()}`,
                ]),
                mentions: m.participants.map(p => p.id)
            });
            await react(sock, jid, sent.key, '📢');
        } catch (e) {
            console.error('❌ tagall error:', e.message);
        }
        return;
    }

    if (lower === '.tagadmins' || lower === 'tagadmins') {
        try {
            const m = await sock.groupMetadata(jid);
            const ad = m.participants.filter(p => p.admin);
            const tags = ad.map(p => `@${getSenderNumber(p.id)}`).join(' ');
            const sent = await sock.sendMessage(jid, {
                text: box('📢 *ATTENTION ADMINS!*', [
                    tags,
                    '',
                    `  👮 Called by: @${senderMention}`,
                    `  📅 ${new Date().toLocaleString()}`,
                ]),
                mentions: ad.map(p => p.id)
            });
            await react(sock, jid, sent.key, '👑');
        } catch (e) {
            console.error('❌ tagadmins error:', e.message);
        }
        return;
    }

    if (lower === '.pick' || lower === 'pick' || lower === '.random') {
        try {
            const m = await sock.groupMetadata(jid);
            const pool = m.participants.filter(p => !p.admin);
            if (!pool.length) {
                await sock.sendMessage(jid, { text: '❌ *No members to pick from!*' });
                return;
            }
            const picked = pool[Math.floor(Math.random() * pool.length)];
            const pNum = getSenderNumber(picked.id);
            const sent = await sock.sendMessage(jid, {
                text: box('🎲 *RANDOM PICK!*', [
                    '  🎯 The lucky one is...',
                    '',
                    `  🌟 @${pNum}`,
                    '',
                    '  🎉 Congratulations!',
                    `  👤 Picked by: @${senderMention}`,
                ]),
                mentions: [picked.id, sender]
            });
            await react(sock, jid, sent.key, '🎲');
        } catch (e) {
            console.error('❌ pick error:', e.message);
        }
        return;
    }

    // ═══════════════════════════════════════
    // 📊 POLLS
    // ═══════════════════════════════════════

    if (lower.startsWith('.poll ') || lower.startsWith('poll ')) {
        const q = text.replace(/^\.?poll\s+/, '').trim();
        if (!q) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.poll Your Question Here`', '', '  📊 Creates a yes/no/maybe poll'])
            });
            return;
        }
        await sock.sendMessage(jid, {
            poll: { name: '📊 ' + q, values: ['👍 Yes', '👎 No', '🤔 Maybe'], selectableCount: 1 }
        });
        return;
    }

    if (lower.startsWith('.custompoll ')) {
        const parts = text.replace(/^\.?custompoll\s+/, '').split('|').map(s => s.trim());
        if (parts.length < 3) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.custompoll Question | Option1 | Option2`'])
            });
            return;
        }
        const [question, ...options] = parts;
        await sock.sendMessage(jid, {
            poll: { name: '📊 ' + question, values: options.slice(0, 12), selectableCount: 1 }
        });
        return;
    }

    // ═══════════════════════════════════════
    // 💤 AFK
    // ═══════════════════════════════════════

    if (lower.startsWith('.afk') || lower.startsWith('afk ')) {
        const r = text.replace(/^\.?afk\s*/, '').trim() || 'No reason given';
        await db.afkSet(sender, r);
        const sent = await sock.sendMessage(jid, {
            text: box('💤 *AFK STATUS*', [
                `  👤 @${senderMention} is now *AFK*`,
                `  📝 Reason: *${r}*`,
                `  ⏰ Time: ${new Date().toLocaleTimeString()}`,
                '',
                '  💬 They will be notified when mentioned.',
            ]),
            mentions: [sender]
        });
        await react(sock, jid, sent.key, '💤');
        return;
    }

    // ═══════════════════════════════════════
    // 🔗 INVITE LINK
    // ═══════════════════════════════════════

    if (lower === '.link' || lower === 'link' || lower === '.invitelink') {
        if (!canManage) {
            await sock.sendMessage(jid, { text: '❌ *Admins only!*' });
            return;
        }
        try {
            const code = await sock.groupInviteCode(jid);
            const sent = await sock.sendMessage(jid, {
                text: box('🔗 *GROUP INVITE LINK*', [
                    `  https://chat.whatsapp.com/${code}`,
                    '',
                    `  👮 Generated by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
            await react(sock, jid, sent.key, '🔗');
        } catch (e) {
            console.error('❌ link error:', e.message);
        }
        return;
    }

    if (lower === '.revoke' || lower === 'revoke') {
        if (!canManage) { await sock.sendMessage(jid, { text: '❌ *Admins only!*' }); return; }
        try {
            await sock.groupRevokeInvite(jid);
            const sent = await sock.sendMessage(jid, {
                text: box('🔄 *LINK REVOKED*', [
                    '  ✅ Old link invalid',
                    `  👮 Revoked by: @${senderMention}`,
                ]),
                mentions: [sender]
            });
            await react(sock, jid, sent.key, '🔄');
        } catch (e) {
            console.error('❌ revoke error:', e.message);
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🎮 FUN COMMANDS
    // ═══════════════════════════════════════

    if (lower === '.dice' || lower === 'dice' || lower === '.roll') {
        const result = Math.floor(Math.random() * 6) + 1;
        const faces = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
        const sent = await sock.sendMessage(jid, {
            text: box('🎲 *DICE ROLL*', [
                `  🎲 @${senderMention} rolled...`,
                `  ${faces[result]} *${result}*`,
                result === 6 ? '  🎉 *Lucky Six!*' : result === 1 ? '  😬 *Unlucky!*' : '  🎯 *Nice roll!*',
            ]),
            mentions: [sender]
        });
        await react(sock, jid, sent.key, '🎲');
        return;
    }

    if (lower === '.flip' || lower === 'flip' || lower === '.coinflip') {
        const result = Math.random() > 0.5 ? 'Heads' : 'Tails';
        const sent = await sock.sendMessage(jid, {
            text: box('🪙 *COIN FLIP*', [
                `  🪙 @${senderMention} flipped...`,
                `  ${result === 'Heads' ? '🌕 *HEADS!*' : '🌑 *TAILS!*'}`,
            ]),
            mentions: [sender]
        });
        await react(sock, jid, sent.key, '🪙');
        return;
    }

    if (lower === '.quote' || lower === 'quote') {
        const quotes = [
            { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
            { text: 'In the middle of every difficulty lies opportunity.', author: 'Albert Einstein' },
            { text: 'Life is what happens when you\'re busy making other plans.', author: 'John Lennon' },
            { text: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
        ];
        const q = quotes[Math.floor(Math.random() * quotes.length)];
        const sent = await sock.sendMessage(jid, {
            text: box('💬 *DAILY QUOTE*', [`  💭 *"${q.text}"*`, '', `  ✍️ — *${q.author}*`])
        });
        await react(sock, jid, sent.key, '💬');
        return;
    }

    if (lower.startsWith('.8ball ') || lower.startsWith('8ball ')) {
        const question = text.replace(/^\.?8ball\s+/, '').trim();
        const answers = ['✅ *Yes!*', '✅ *Definitely*', '🤔 *Maybe*', '❌ *No*', '❌ *Doubtful*'];
        const answer = answers[Math.floor(Math.random() * answers.length)];
        const sent = await sock.sendMessage(jid, {
            text: box('🎱 *MAGIC 8 BALL*', [`  ❓ Q: ${question}`, '', `  🎱 A: ${answer}`]),
            mentions: [sender]
        });
        await react(sock, jid, sent.key, '🎱');
        return;
    }

    if (lower.startsWith('.roast ') || lower.startsWith('roast ')) {
        if (!mentioned.length) {
            await sock.sendMessage(jid, { text: box('💡 *USAGE*', ['  📝 `.roast @user`']) });
            return;
        }
        const target = mentioned[0];
        const roasts = [
            'You\'re the reason they put instructions on shampoo bottles! 😂',
            'I\'d agree with you but then we\'d both be wrong! 🤣',
            'If laughter is the best medicine, your face must be curing the world! 😂',
        ];
        const roast = roasts[Math.floor(Math.random() * roasts.length)];
        const sent = await sock.sendMessage(jid, {
            text: box('🔥 *ROASTED!*', [`  🎯 @${getSenderNumber(target)}`, '', `  🔥 ${roast}`, '', `  👤 By: @${senderMention}`]),
            mentions: [target, sender]
        });
        await react(sock, jid, sent.key, '🔥');
        return;
    }

    if (lower.startsWith('.compliment ') || lower.startsWith('compliment ')) {
        if (!mentioned.length) {
            await sock.sendMessage(jid, { text: box('💡 *USAGE*', ['  📝 `.compliment @user`']) });
            return;
        }
        const target = mentioned[0];
        const compliments = [
            'You light up every room you walk into! ✨',
            'Your kindness is truly inspiring! 💝',
            'You\'re one of a kind! 🌟',
        ];
        const comp = compliments[Math.floor(Math.random() * compliments.length)];
        const sent = await sock.sendMessage(jid, {
            text: box('💝 *COMPLIMENT*', [`  🌟 @${getSenderNumber(target)}`, '', `  💝 ${comp}`, '', `  👤 From: @${senderMention}`]),
            mentions: [target, sender]
        });
        await react(sock, jid, sent.key, '💝');
        return;
    }
}

module.exports = { handleGroupCommands };
