const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ═══════════════════════════════════════════════════════
// 📁 VOICE REPLIES CONFIG
// ═══════════════════════════════════════════════════════

let voiceReplies = { replies: {} };
const VOICE_FILE_PATH = path.join(__dirname, '..', 'voiceReplies.json');

try {
    if (fs.existsSync(VOICE_FILE_PATH)) {
        const data = fs.readFileSync(VOICE_FILE_PATH, 'utf8');
        voiceReplies = JSON.parse(data);
        console.log(`✅ Loaded ${Object.keys(voiceReplies.replies || {}).length} voice replies`);
    } else {
        console.log('⚠️ voiceReplies.json not found, creating default...');
        // Create default file
        const defaultReplies = { replies: {} };
        fs.writeFileSync(VOICE_FILE_PATH, JSON.stringify(defaultReplies, null, 2));
        voiceReplies = defaultReplies;
    }
} catch (e) {
    console.log('⚠️ Failed to load voiceReplies.json:', e.message);
    voiceReplies = { replies: {} };
}

// ═══════════════════════════════════════════════════════
// 🎨 HELPERS
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

const divider = (title) => `┄`.repeat(10) + ` ${title} ` + `┄`.repeat(10);

// ═══════════════════════════════════════════════════════
// 🎵 VOICE REPLY HANDLER
// ═══════════════════════════════════════════════════════

async function handleVoiceReply(sock, jid, text, msg, isUserOwner, db) {
    // Check if voice replies are enabled
    if (isUserOwner) {
        return false;
    }

    const voiceEnabled = await db.get('voiceReplyEnabled', true).catch(() => true);
    if (!voiceEnabled) {
        return false;
    }

    // Check if there are any voice replies configured
    const replies = voiceReplies.replies || {};
    if (Object.keys(replies).length === 0) {
        return false;
    }

    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);

    // Try to match triggers
    for (const [trigger, url] of Object.entries(replies)) {
        const tl = trigger.toLowerCase();
        let matched = false;

        // Exact match
        if (lower === tl) {
            matched = true;
        }
        // Word match
        else if (words.includes(tl)) {
            matched = true;
        }
        // Phrase match
        else if (tl.includes(' ') && lower.includes(tl)) {
            matched = true;
        }

        if (matched) {
            try {
                // Download audio
                const response = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 20000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const buffer = Buffer.from(response.data);

                // Validate audio buffer
                if (buffer.length < 100) {
                    console.warn(`⚠️ Voice reply for "${trigger}" is too small (${buffer.length} bytes)`);
                    continue;
                }

                // Send audio message
                const sent = await sock.sendMessage(jid, {
                    audio: buffer,
                    mimetype: 'audio/mpeg',
                    ptt: true
                }, { quoted: msg });

                // React with music note
                await react(sock, jid, sent.key, '🎵');

                console.log(`✅ Voice reply played for: "${trigger}"`);
                return true;

            } catch (error) {
                console.error(`❌ Failed to play voice reply for "${trigger}":`, error.message);

                // Try to send error message once
                if (!msg.key?.fromMe) {
                    try {
                        await sock.sendMessage(jid, {
                            text: box('🎵 *VOICE REPLY ERROR*', [
                                '  ❌ Failed to play voice reply',
                                '  📝 Trigger: *' + trigger + '*',
                                '',
                                '  🔄 Please try again later',
                            ])
                        });
                    } catch (e) {}
                }
                break;
            }
        }
    }

    return false;
}

// ═══════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════

function getVoiceReplyCount() {
    return Object.keys(voiceReplies.replies || {}).length;
}

function getVoiceReplyTriggers() {
    return Object.keys(voiceReplies.replies || {});
}

function addVoiceReply(trigger, url) {
    voiceReplies.replies[trigger] = url;
    try {
        fs.writeFileSync(VOICE_FILE_PATH, JSON.stringify(voiceReplies, null, 2));
        return true;
    } catch (e) {
        console.error('Failed to save voice reply:', e);
        return false;
    }
}

function removeVoiceReply(trigger) {
    if (voiceReplies.replies[trigger]) {
        delete voiceReplies.replies[trigger];
        try {
            fs.writeFileSync(VOICE_FILE_PATH, JSON.stringify(voiceReplies, null, 2));
            return true;
        } catch (e) {
            console.error('Failed to remove voice reply:', e);
            return false;
        }
    }
    return false;
}

function listVoiceReplies() {
    return voiceReplies.replies;
}

// ═══════════════════════════════════════════════════════
// 🎵 VOICE REPLY COMMANDS (Optional)
// ═══════════════════════════════════════════════════════

async function handleVoiceCommands(sock, msg, jid, text, lower, sender, db, isOwner) {
    if (!isOwner) return false;

    const prefix = await db.get('prefix', '.');

    // List all voice replies
    if (lower === '.voicelist' || lower === 'voicelist') {
        const replies = listVoiceReplies();
        const keys = Object.keys(replies);

        if (keys.length === 0) {
            await sock.sendMessage(jid, {
                text: box('🎵 *VOICE REPLIES*', [
                    '  ❌ No voice replies configured',
                    '',
                    '  💡 Add one with:',
                    '  `.addvoice trigger audio_url`',
                ])
            });
            return true;
        }

        const lines = keys.map((key, i) => 
            `  ${i + 1}. *${key}* → [Audio]`
        );

        await sock.sendMessage(jid, {
            text: box(`🎵 *VOICE REPLIES (${keys.length})*`, [
                ...lines,
                '',
                divider('💡 Commands'),
                '  `.addvoice trigger url` - Add new',
                '  `.removevoice trigger` - Remove',
                '  `.voicelist` - Show all',
            ])
        });
        return true;
    }

    // Add voice reply
    if (lower.startsWith('.addvoice ') || lower.startsWith('addvoice ')) {
        const parts = text.replace(/^\.?addvoice\s+/, '').trim().split(' ');
        if (parts.length < 2) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', [
                    '  📝 `.addvoice trigger audio_url`',
                    '',
                    '  🎵 Adds a voice reply trigger',
                    '  💡 The audio URL must be a direct MP3 link',
                    '',
                    '  📱 Example:',
                    '  `.addvoice hello https://example.com/hello.mp3`',
                ])
            });
            return true;
        }

        const trigger = parts[0];
        const url = parts.slice(1).join(' ');

        // Validate URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            await sock.sendMessage(jid, {
                text: box('❌ *INVALID URL*', [
                    '  ❌ URL must start with http:// or https://',
                    '',
                    '  💡 Example:',
                    '  `https://example.com/audio.mp3`',
                ])
            });
            return true;
        }

        // Test the URL
        try {
            const test = await axios.head(url, { timeout: 5000 });
            if (test.status !== 200) {
                await sock.sendMessage(jid, {
                    text: box('❌ *URL ERROR*', [
                        '  ❌ URL returned status: ' + test.status,
                        '',
                        '  💡 Please check the URL and try again',
                    ])
                });
                return true;
            }
        } catch (e) {
            await sock.sendMessage(jid, {
                text: box('❌ *URL ERROR*', [
                    '  ❌ Failed to access URL',
                    '  📝 Error: ' + e.message,
                    '',
                    '  💡 Please check the URL and try again',
                ])
            });
            return true;
        }

        if (addVoiceReply(trigger, url)) {
            const sent = await sock.sendMessage(jid, {
                text: box('✅ *VOICE REPLY ADDED*', [
                    `  🎵 Trigger: *${trigger}*`,
                    `  🔗 URL: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`,
                    '',
                    `  👮 Added by: @${sender}`,
                ]),
                mentions: [sender]
            });
            await react(sock, jid, sent.key, '✅');
        } else {
            await sock.sendMessage(jid, {
                text: box('❌ *FAILED*', [
                    '  ❌ Could not save voice reply',
                    '  💡 Check file permissions',
                ])
            });
        }
        return true;
    }

    // Remove voice reply
    if (lower.startsWith('.removevoice ') || lower.startsWith('removevoice ')) {
        const trigger = text.replace(/^\.?removevoice\s+/, '').trim();
        if (!trigger) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', [
                    '  📝 `.removevoice trigger`',
                    '',
                    '  🗑️ Removes a voice reply trigger',
                ])
            });
            return true;
        }

        if (removeVoiceReply(trigger)) {
            const sent = await sock.sendMessage(jid, {
                text: box('🗑️ *VOICE REPLY REMOVED*', [
                    `  🎵 Trigger: *${trigger}*`,
                    '',
                    `  👮 Removed by: @${sender}`,
                ]),
                mentions: [sender]
            });
            await react(sock, jid, sent.key, '🗑️');
        } else {
            await sock.sendMessage(jid, {
                text: box('❌ *NOT FOUND*', [
                    `  ❌ No voice reply found for "*${trigger}*"`,
                    '',
                    '  💡 Use `.voicelist` to see all triggers',
                ])
            });
        }
        return true;
    }

    return false;
}

// ═══════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════

module.exports = {
    handleVoiceReply,
    handleVoiceCommands,
    getVoiceReplyCount,
    getVoiceReplyTriggers,
    addVoiceReply,
    removeVoiceReply,
    listVoiceReplies
};
