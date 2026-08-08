const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const { SAVE_FOLDER, VV_FOLDER, STATUS_FOLDER } = require('../utils/constants');

// ═══════════════════════════════════════════════════════
// 🛡️ SAFE SENDER HELPERS
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

const divider = (title) => '┄'.repeat(10) + ' ' + title + ' ' + '┄'.repeat(10);

// ═══════════════════════════════════════════════════════
// 💾 SAVE MEDIA TO FILE HELPER
// ═══════════════════════════════════════════════════════

async function saveMediaToFile(msg) {
    try {
        const baileys = await import('@whiskeysockets/baileys');
        const buffer = await baileys.downloadMediaMessage(
            msg, 'buffer', {},
            { logger: { info: () => {}, error: () => {}, warn: () => {} } }
        );
        if (!buffer || buffer.length < 100) return null;

        const mime = msg.message?.videoMessage?.mimetype
            || msg.message?.imageMessage?.mimetype
            || msg.message?.audioMessage?.mimetype
            || 'application/octet-stream';

        const ext = mime.split('/')[1] || 'bin';
        const filename = `media_${Date.now()}.${ext}`;
        const filepath = path.join(SAVE_FOLDER, filename);

        if (!fs.existsSync(SAVE_FOLDER)) fs.mkdirSync(SAVE_FOLDER, { recursive: true });
        fs.writeFileSync(filepath, buffer);

        return { buffer, filepath, filename, mimetype: mime };
    } catch (e) {
        console.error('saveMediaToFile error:', e.message);
        return null;
    }
}

// ═══════════════════════════════════════════════════════
// 🎬 MEDIA COMMANDS HANDLER
// ═══════════════════════════════════════════════════════

async function handleMediaCommands(sock, msg, jid, text, lower, sender, db, command) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const senderMention = getSenderMention(sender);

    if (!command) command = lower;

    // ═══════════════════════════════════════
    // 💾 SAVE MEDIA (works for status + regular media)
    // ═══════════════════════════════════════
    if (command === '.save' || command === 'save' || lower === '.save' || lower === 'save') {
        if (!quotedMsg) {
            await sock.sendMessage(jid, {
                text: '💡 *Reply to media/status* with `.save`\n\n📸 Photo | 🎥 Video | 🎵 Audio | 📱 Status'
            });
            return;
        }
        await react(sock, jid, msg.key, '⏳');
        
        try {
            const baileys = await import('@whiskeysockets/baileys');
            
            // Build the message object for download
            const fm = {
                key: { 
                    remoteJid: msg.message?.extendedTextMessage?.contextInfo?.remoteJid || jid,
                    id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'save_' + Date.now(),
                    participant: msg.message?.extendedTextMessage?.contextInfo?.participant
                },
                message: quotedMsg
            };
            
            const buffer = await baileys.downloadMediaMessage(
                fm, 'buffer', {},
                { logger: { info: () => {}, error: () => {}, warn: () => {} } }
            );
            
            if (!buffer || buffer.length < 100) {
                await react(sock, jid, msg.key, '❌');
                await sock.sendMessage(jid, { text: '❌ *No media found!*\n💡 Status may have expired (24h)' });
                return;
            }

            const sizeKB = (buffer.length / 1024).toFixed(1);
            const fromUser = msg.message?.extendedTextMessage?.contextInfo?.participant?.split('@')[0] || '';
            const caption = `💾 *Saved!*\n📏 ${sizeKB} KB${fromUser ? '\n👤 @' + fromUser : ''}\n\n✅ *Forward this to share!*`;

            // Send back based on type
            if (quotedMsg?.imageMessage) {
                await sock.sendMessage(jid, { 
                    image: buffer, 
                    caption, 
                    mimetype: 'image/jpeg',
                    ...(fromUser ? { mentions: [msg.message.extendedTextMessage.contextInfo.participant] } : {})
                });
            } else if (quotedMsg?.videoMessage) {
                await sock.sendMessage(jid, { 
                    video: buffer, 
                    caption, 
                    mimetype: 'video/mp4',
                    ...(fromUser ? { mentions: [msg.message.extendedTextMessage.contextInfo.participant] } : {})
                });
            } else if (quotedMsg?.audioMessage) {
                await sock.sendMessage(jid, { 
                    audio: buffer, 
                    mimetype: 'audio/mp4', 
                    ptt: true 
                });
                await sock.sendMessage(jid, { 
                    text: `🎵 *Audio Saved!*\n📏 ${sizeKB} KB${fromUser ? '\n👤 @' + fromUser : ''}`,
                    ...(fromUser ? { mentions: [msg.message.extendedTextMessage.contextInfo.participant] } : {})
                });
            } else if (quotedMsg?.stickerMessage) {
                await sock.sendMessage(jid, { sticker: buffer });
                await sock.sendMessage(jid, { text: `🎨 *Sticker Saved!*\n📏 ${sizeKB} KB` });
            } else if (quotedMsg?.documentMessage) {
                await sock.sendMessage(jid, { 
                    document: buffer, 
                    fileName: quotedMsg.documentMessage?.fileName || `file_${Date.now()}`,
                    caption,
                    mimetype: quotedMsg.documentMessage?.mimetype || 'application/octet-stream'
                });
            } else {
                // Unknown type - send as document
                await sock.sendMessage(jid, { 
                    document: buffer, 
                    fileName: `media_${Date.now()}`,
                    caption: `💾 *Saved!*\n📏 ${sizeKB} KB`
                });
            }
            
            await react(sock, jid, msg.key, '✅');
            
        } catch (error) {
            console.error('❌ Save error:', error.message);
            await react(sock, jid, msg.key, '❌');
            await sock.sendMessage(jid, { text: '❌ *Failed to save!*\n' + error.message });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 💾 SAVE STATUS (ssave) - sends back + saves
    // ═══════════════════════════════════════

    if (command === '.ssave' || command === 'ssave') {
        if (!quotedMsg) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 Reply to media with `.ssave`', '', '  💾 Saves & sends status media'])
            });
            return;
        }
        await react(sock, jid, msg.key, '⏳');
        const fm = {
            key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'ssave_' + Date.now() },
            message: quotedMsg
        };
        try {
            const baileys = await import('@whiskeysockets/baileys');
            const buffer = await baileys.downloadMediaMessage(
                fm, 'buffer', {},
                { logger: { info: () => {}, error: () => {}, warn: () => {} } }
            );
            if (!buffer || buffer.length < 100) {
                await react(sock, jid, msg.key, '❌');
                return;
            }
            const ext = quotedMsg?.videoMessage ? 'mp4'
                : quotedMsg?.imageMessage ? 'jpg'
                : quotedMsg?.audioMessage ? 'mp3' : 'bin';
            const filename = `status_${Date.now()}.${ext}`;
            if (!fs.existsSync(STATUS_FOLDER)) fs.mkdirSync(STATUS_FOLDER, { recursive: true });
            fs.writeFileSync(path.join(STATUS_FOLDER, filename), buffer);

            // Send back
            if (quotedMsg?.imageMessage) {
                await sock.sendMessage(jid, { image: buffer, caption: `💾 *Status Saved!*\n📁 ${filename}` });
            } else if (quotedMsg?.videoMessage) {
                await sock.sendMessage(jid, { video: buffer, caption: `💾 *Status Saved!*\n📁 ${filename}` });
            } else {
                await sock.sendMessage(jid, { text: `💾 *Status Saved!*\n📁 ${filename}` });
            }
            await react(sock, jid, msg.key, '✅');
        } catch {
            await react(sock, jid, msg.key, '❌');
        }
        return;
    }

    // ═══════════════════════════════════════
    // 👁️ VIEW ONCE (vv) - sends back
    // ═══════════════════════════════════════

    if (command === '.vv' || command === 'vv') {
        if (!quotedMsg) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 Reply to view-once with `.vv`', '', '  👁️ Reveals hidden media'])
            });
            return;
        }
        await react(sock, jid, msg.key, '⏳');
        const fm = {
            key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'vv_' + Date.now() },
            message: quotedMsg
        };
        try {
            const baileys = await import('@whiskeysockets/baileys');
            const buffer = await baileys.downloadMediaMessage(
                fm, 'buffer', {},
                { logger: { info: () => {}, error: () => {}, warn: () => {} } }
            );
            if (!buffer || buffer.length < 100) {
                await react(sock, jid, msg.key, '❌');
                return;
            }

            if (quotedMsg?.videoMessage) {
                await sock.sendMessage(jid, {
                    video: buffer,
                    caption: '👁️ *View-Once Revealed!*',
                    mimetype: 'video/mp4'
                });
                await react(sock, jid, msg.key, '✅');
            } else if (quotedMsg?.imageMessage) {
                await sock.sendMessage(jid, {
                    image: buffer,
                    caption: '👁️ *View-Once Revealed!*',
                    mimetype: 'image/jpeg'
                });
                await react(sock, jid, msg.key, '✅');
            } else {
                await sock.sendMessage(jid, { text: '❌ *Not a view-once message!*' });
            }
        } catch {
            await react(sock, jid, msg.key, '❌');
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🖼️ IMAGE TO STICKER
    // ═══════════════════════════════════════

    if (command === '.sticker' || command === 'sticker' || command === '.s') {
        if (!quotedMsg?.imageMessage && !quotedMsg?.videoMessage) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 Reply to an image/video with `.sticker`', '', '  🖼️ Creates a sticker'])
            });
            return;
        }
        await react(sock, jid, msg.key, '⏳');
        const fm = {
            key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'sticker_' + Date.now() },
            message: quotedMsg
        };
        try {
            const baileys = await import('@whiskeysockets/baileys');
            const buffer = await baileys.downloadMediaMessage(
                fm, 'buffer', {},
                { logger: { info: () => {}, error: () => {}, warn: () => {} } }
            );
            if (!buffer || buffer.length < 100) {
                await react(sock, jid, msg.key, '❌');
                return;
            }

            const tmpInput = path.join('/tmp', `sticker_in_${Date.now()}.${quotedMsg?.videoMessage ? 'mp4' : 'png'}`);
            const tmpOutput = path.join('/tmp', `sticker_out_${Date.now()}.webp`);
            fs.writeFileSync(tmpInput, buffer);

            await new Promise((resolve, reject) => {
                exec(`ffmpeg -i "${tmpInput}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -lossless 0 -q:v 75 -preset default -loop 0 -an -fs 1M "${tmpOutput}"`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            const stickerBuffer = fs.readFileSync(tmpOutput);
            await sock.sendMessage(jid, { sticker: stickerBuffer });
            await react(sock, jid, msg.key, '✅');

            try { fs.unlinkSync(tmpInput); fs.unlinkSync(tmpOutput); } catch {}
        } catch {
            await react(sock, jid, msg.key, '❌');
            await sock.sendMessage(jid, { text: '❌ *Failed to create sticker!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 📸 STICKER TO IMAGE
    // ═══════════════════════════════════════

    if (command === '.toimg' || command === 'toimg') {
        if (!quotedMsg?.stickerMessage) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 Reply to a sticker with `.toimg`', '', '  📸 Converts sticker to image'])
            });
            return;
        }
        await react(sock, jid, msg.key, '⏳');
        const fm = {
            key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'toimg_' + Date.now() },
            message: quotedMsg
        };
        try {
            const baileys = await import('@whiskeysockets/baileys');
            const buffer = await baileys.downloadMediaMessage(
                fm, 'buffer', {},
                { logger: { info: () => {}, error: () => {}, warn: () => {} } }
            );
            if (!buffer || buffer.length < 100) {
                await react(sock, jid, msg.key, '❌');
                return;
            }

            const tmpInput = path.join('/tmp', `toimg_in_${Date.now()}.webp`);
            const tmpOutput = path.join('/tmp', `toimg_out_${Date.now()}.png`);
            fs.writeFileSync(tmpInput, buffer);

            await new Promise((resolve, reject) => {
                exec(`ffmpeg -i "${tmpInput}" "${tmpOutput}"`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            const imgBuffer = fs.readFileSync(tmpOutput);
            await sock.sendMessage(jid, {
                image: imgBuffer,
                caption: '📸 *Sticker → Image*',
                mimetype: 'image/png'
            });
            await react(sock, jid, msg.key, '✅');

            try { fs.unlinkSync(tmpInput); fs.unlinkSync(tmpOutput); } catch {}
        } catch {
            await react(sock, jid, msg.key, '❌');
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🎬 STICKER TO GIF
    // ═══════════════════════════════════════

    if (command === '.togif' || command === 'togif') {
        if (!quotedMsg?.stickerMessage) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 Reply to animated sticker with `.togif`', '', '  🎬 Converts to GIF'])
            });
            return;
        }
        await react(sock, jid, msg.key, '⏳');
        const fm = {
            key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'togif_' + Date.now() },
            message: quotedMsg
        };
        try {
            const baileys = await import('@whiskeysockets/baileys');
            const buffer = await baileys.downloadMediaMessage(
                fm, 'buffer', {},
                { logger: { info: () => {}, error: () => {}, warn: () => {} } }
            );
            if (!buffer || buffer.length < 100) {
                await react(sock, jid, msg.key, '❌');
                return;
            }

            const tmpInput = path.join('/tmp', `togif_in_${Date.now()}.webp`);
            const tmpOutput = path.join('/tmp', `togif_out_${Date.now()}.mp4`);
            fs.writeFileSync(tmpInput, buffer);

            await new Promise((resolve, reject) => {
                exec(`ffmpeg -i "${tmpInput}" -vf "fps=10,scale=512:512:force_original_aspect_ratio=decrease" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 -an "${tmpOutput}"`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            const vidBuffer = fs.readFileSync(tmpOutput);
            await sock.sendMessage(jid, {
                video: vidBuffer,
                gifPlayback: true,
                caption: '🎬 *Sticker → GIF*',
                mimetype: 'video/mp4'
            });
            await react(sock, jid, msg.key, '✅');

            try { fs.unlinkSync(tmpInput); fs.unlinkSync(tmpOutput); } catch {}
        } catch {
            await react(sock, jid, msg.key, '❌');
        }
        return;
    }

    // ═══════════════════════════════════════
    // 😊 EMOJI TO STICKER
    // ═══════════════════════════════════════

    if (command.startsWith('.emoji') || command.startsWith('emoji')) {
        const emoji = text.replace(/^\.?emoji\s*/, '').trim();
        if (!emoji) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 `.emoji 😊`', '', '  😊 Creates a sticker from emoji'])
            });
            return;
        }
        await react(sock, jid, msg.key, '⏳');
        try {
            const codePoint = [...emoji][0]?.codePointAt(0)?.toString(16);
            if (!codePoint) {
                await sock.sendMessage(jid, { text: '❌ *Invalid emoji!*' });
                return;
            }

            const emojiUrl = `https://emojiapi.dev/api/v1/${codePoint}/128.png`;
            const res = await axios.get(emojiUrl, { responseType: 'arraybuffer', timeout: 10000 });

            if (!res.data || res.data.length < 100) {
                await sock.sendMessage(jid, { text: '❌ *Failed to get emoji image!*' });
                return;
            }

            const tmpInput = path.join('/tmp', `emoji_in_${Date.now()}.png`);
            const tmpOutput = path.join('/tmp', `emoji_out_${Date.now()}.webp`);
            fs.writeFileSync(tmpInput, Buffer.from(res.data));

            await new Promise((resolve, reject) => {
                exec(`ffmpeg -i "${tmpInput}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -lossless 0 -q:v 75 -preset default -loop 0 -an -fs 500K "${tmpOutput}"`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            const stickerBuffer = fs.readFileSync(tmpOutput);
            await sock.sendMessage(jid, { sticker: stickerBuffer });
            await react(sock, jid, msg.key, '✅');

            try { fs.unlinkSync(tmpInput); fs.unlinkSync(tmpOutput); } catch {}
        } catch {
            await react(sock, jid, msg.key, '❌');
        }
        return;
    }

    // ═══════════════════════════════════════
    // ✨ REMOVE BACKGROUND
    // ═══════════════════════════════════════

    if (command === '.removebg' || command === 'removebg' || command === '.nobg') {
        if (!quotedMsg?.imageMessage) {
            await sock.sendMessage(jid, {
                text: box('💡 *USAGE*', ['  📝 Reply to an image with `.removebg`', '', '  ✨ Removes background from image'])
            });
            return;
        }
        await react(sock, jid, msg.key, '⏳');
        const fm = {
            key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'removebg_' + Date.now() },
            message: quotedMsg
        };
        try {
            const baileys = await import('@whiskeysockets/baileys');
            const buffer = await baileys.downloadMediaMessage(
                fm, 'buffer', {},
                { logger: { info: () => {}, error: () => {}, warn: () => {} } }
            );
            if (!buffer || buffer.length < 100) {
                await react(sock, jid, msg.key, '❌');
                return;
            }

            const removeBgApi = 'https://api.remove.bg/v1.0/removebg';
            const apiKey = process.env.REMOVE_BG_KEY || '';

            if (!apiKey) {
                await sock.sendMessage(jid, { text: '❌ *Remove.bg API key not configured!*' });
                return;
            }

            const formData = new (require('form-data'))();
            formData.append('image_file', buffer, 'image.png');
            formData.append('size', 'auto');

            const response = await axios.post(removeBgApi, formData, {
                headers: { 'X-Api-Key': apiKey, ...formData.getHeaders() },
                responseType: 'arraybuffer',
                timeout: 30000
            });

            if (response.data?.length > 100) {
                await sock.sendMessage(jid, {
                    image: Buffer.from(response.data),
                    caption: '✨ *Background Removed!*',
                    mimetype: 'image/png'
                });
                await react(sock, jid, msg.key, '✅');
            } else {
                await react(sock, jid, msg.key, '❌');
            }
        } catch {
            await react(sock, jid, msg.key, '❌');
            await sock.sendMessage(jid, { text: '❌ *Failed to remove background!*' });
        }
        return;
    }

    // ═══════════════════════════════════════
    // 🎬 GIF MESSAGE
    // ═══════════════════════════════════════

    if (command === '.gif' || command === 'gif') {
        const qm = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!qm?.videoMessage) {
            await sock.sendMessage(jid, { text: box('💡 *USAGE*', ['  📝 Reply to a video with `.gif`']) });
            return;
        }
        await react(sock, jid, msg.key, '⏳');
        try {
            const fm = {
                key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'gif_' + Date.now() },
                message: qm
            };
            const sv = await saveMediaToFile(fm);
            if (sv) {
                await sock.sendMessage(jid, {
                    video: sv.buffer,
                    gifPlayback: true,
                    caption: '🎬 *GIF!*',
                    mimetype: 'video/mp4'
                });
                await react(sock, jid, msg.key, '✅');
            } else {
                await react(sock, jid, msg.key, '❌');
            }
        } catch { await react(sock, jid, msg.key, '❌'); }
        return;
    }

    // ═══════════════════════════════════════
    // ⭕ VIDEO NOTE (Circle Video / PTV)
    // ═══════════════════════════════════════

    if (command === '.ptv' || command === 'ptv') {
        const qm = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!qm?.videoMessage) {
            await sock.sendMessage(jid, { text: box('💡 *USAGE*', ['  📝 Reply to a video with `.ptv`', '  ⭕ Sends as circle video note']) });
            return;
        }
        await react(sock, jid, msg.key, '⏳');
        try {
            const fm = {
                key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'ptv_' + Date.now() },
                message: qm
            };
            const sv = await saveMediaToFile(fm);
            if (sv) {
                await sock.sendMessage(jid, { video: sv.buffer, ptv: true, mimetype: 'video/mp4' });
                await react(sock, jid, msg.key, '✅');
            } else {
                await react(sock, jid, msg.key, '❌');
            }
        } catch { await react(sock, jid, msg.key, '❌'); }
        return;
    }

    // ═══════════════════════════════════════
    // 🖼️ QUICK STICKER
    // ═══════════════════════════════════════

    if (command === '.qs' || command === 'qs') {
        if (!quotedMsg?.imageMessage) {
            await sock.sendMessage(jid, { text: box('💡 *USAGE*', ['  📝 Reply to an image with `.qs`', '', '  ⚡ Quick sticker from image']) });
            return;
        }
        await react(sock, jid, msg.key, '⏳');
        const fm = {
            key: { remoteJid: jid, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || 'qs_' + Date.now() },
            message: quotedMsg
        };
        try {
            const baileys = await import('@whiskeysockets/baileys');
            const buffer = await baileys.downloadMediaMessage(
                fm, 'buffer', {},
                { logger: { info: () => {}, error: () => {}, warn: () => {} } }
            );
            if (!buffer || buffer.length < 100) { await react(sock, jid, msg.key, '❌'); return; }

            const tmpInput = path.join('/tmp', `qs_in_${Date.now()}.png`);
            const tmpOutput = path.join('/tmp', `qs_out_${Date.now()}.webp`);
            fs.writeFileSync(tmpInput, buffer);

            await new Promise((resolve, reject) => {
                exec(`ffmpeg -i "${tmpInput}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -lossless 0 -q:v 50 -preset default -loop 0 -an -fs 500K "${tmpOutput}"`, (err) => {
                    if (err) reject(err); else resolve();
                });
            });

            const stickerBuffer = fs.readFileSync(tmpOutput);
            await sock.sendMessage(jid, { sticker: stickerBuffer });
            await react(sock, jid, msg.key, '✅');
            try { fs.unlinkSync(tmpInput); fs.unlinkSync(tmpOutput); } catch {}
        } catch { await react(sock, jid, msg.key, '❌'); }
        return;
    }
}

module.exports = { handleMediaCommands, saveMediaToFile };
