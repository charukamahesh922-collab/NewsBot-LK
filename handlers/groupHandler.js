// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                 👥 Group Handler 👥                         ║
// ╚══════════════════════════════════════════════════════════════╝

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

// ═══════════════════════════════════════════════════════
// 👥 GROUP PARTICIPANTS UPDATE
// Fires when: add / remove / promote / demote
// ═══════════════════════════════════════════════════════

async function handleGroupUpdate(sock, update, db) {
    try {
        const { id, participants, action } = update;

        // ═══════════════════════════════════════
        // 👋 WELCOME — member added
        // ═══════════════════════════════════════
        if (action === 'add' && await db.get('welcomeEnabled', false)) {
            for (const p of participants) {
                const num = p.split('@')[0];
                try {
                    const meta = await sock.groupMetadata(id);
                    await sock.sendMessage(id, {
                        text: box('🎉 *WELCOME!*', [
                            `  👋 @${num} joined the group!`,
                            '',
                            `  📛 *Group:* ${meta.subject}`,
                            `  👥 *Members:* ${meta.participants.length}`,
                            '',
                            '  🌟 Welcome to the family!',
                        ]),
                        mentions: [p]
                    });
                } catch {
                    await sock.sendMessage(id, {
                        text: `🎉 *Welcome!*\n👋 @${num}`,
                        mentions: [p]
                    });
                }
            }
        }

        // ═══════════════════════════════════════
        // 😢 GOODBYE — member removed/left
        // ═══════════════════════════════════════
        if (action === 'remove' && await db.get('goodbyeEnabled', false)) {
            for (const p of participants) {
                const num = p.split('@')[0];
                await sock.sendMessage(id, {
                    text: box('😢 *GOODBYE!*', [
                        `  👋 @${num} left the group`,
                        '',
                        '  💝 We will miss you!',
                    ]),
                    mentions: [p]
                });
            }
        }

        // ═══════════════════════════════════════
        // 👑 PROMOTE — member made admin
        // ═══════════════════════════════════════
        if (action === 'promote') {
            for (const p of participants) {
                const num = p.split('@')[0];
                await sock.sendMessage(id, {
                    text: box('👑 *NEW ADMIN!*', [
                        `  🌟 @${num} is now an *Admin*`,
                        '',
                        '  🎉 Congratulations!',
                    ]),
                    mentions: [p]
                });
            }
        }

        // ═══════════════════════════════════════
        // ⬇️ DEMOTE — admin removed
        // ═══════════════════════════════════════
        if (action === 'demote') {
            for (const p of participants) {
                const num = p.split('@')[0];
                await sock.sendMessage(id, {
                    text: box('⬇️ *ADMIN REMOVED*', [
                        `  👤 @${num} is no longer an Admin`,
                    ]),
                    mentions: [p]
                });
            }
        }

    } catch (e) {
        console.log('❌ Group participants update error:', e.message);
    }
}

// ═══════════════════════════════════════════════════════
// 🔄 GROUPS UPDATE
// Fires when: name / description / announce /
//             restrict / ephemeral changed
// ═══════════════════════════════════════════════════════

async function handleGroupsUpdate(sock, events) {
    for (const event of events) {
        try {
            const id = event.id;

            // Group name changed
            if (event.subject) {
                await sock.sendMessage(id, {
                    text: box('✏️ *GROUP NAME CHANGED*', [
                        `  📛 New name: *${event.subject}*`,
                        `  ⏰ ${new Date().toLocaleString()}`,
                    ])
                });
            }

            // Group description changed
            if (event.desc !== undefined) {
                await sock.sendMessage(id, {
                    text: box('📝 *DESCRIPTION UPDATED*', [
                        `  📄 ${event.desc || 'Description cleared'}`,
                        `  ⏰ ${new Date().toLocaleString()}`,
                    ])
                });
            }

            // Announce mode (only admins can send)
            if (event.announce !== undefined) {
                await sock.sendMessage(id, {
                    text: box(event.announce ? '🔒 *GROUP CLOSED*' : '🔓 *GROUP OPENED*', [
                        event.announce
                            ? '  🔕 Only admins can send messages'
                            : '  💬 Everyone can send messages',
                        `  ⏰ ${new Date().toLocaleString()}`,
                    ])
                });
            }

            // Restrict mode (only admins can change group info)
            if (event.restrict !== undefined) {
                await sock.sendMessage(id, {
                    text: box(event.restrict ? '🔐 *SETTINGS LOCKED*' : '🔓 *SETTINGS UNLOCKED*', [
                        event.restrict
                            ? '  🔐 Only admins can change group info'
                            : '  🔓 All members can change group info',
                        `  ⏰ ${new Date().toLocaleString()}`,
                    ])
                });
            }

            // Ephemeral (disappearing messages) changed
            if (event.ephemeralDuration !== undefined) {
                const dur = event.ephemeralDuration;
                const label = dur === 86400 ? '24 hours'
                    : dur === 604800 ? '7 days'
                    : dur === 7776000 ? '90 days'
                    : 'Off';
                await sock.sendMessage(id, {
                    text: box('⏳ *DISAPPEARING MESSAGES*', [
                        dur === 0
                            ? '  ❌ Disappearing messages *disabled*'
                            : `  ✅ Messages disappear after *${label}*`,
                        `  ⏰ ${new Date().toLocaleString()}`,
                    ])
                });
            }

        } catch (e) {
            console.log('❌ Groups update error:', e.message);
        }
    }
}

module.exports = { handleGroupUpdate, handleGroupsUpdate };
