// handlers/statusHandler.js

const { STATUS_EMOJIS, STATUS_FOLDER } = require('../utils/constants');
const { saveMediaToFile, getStatusMedia } = require('../utils/helpers');
const fs = require('fs');

let lastStatusMessages = [];
let lastStatusTime = 0;
let statusViewCount = 0;
let statusReactCount = 0;
let statusSaveCount = 0;

// Ensure status folder exists
if (!fs.existsSync(STATUS_FOLDER)) {
    fs.mkdirSync(STATUS_FOLDER, { recursive: true });
    console.log(`📁 Created status folder: ${STATUS_FOLDER}`);
}

function getLastStatusMessages() { return lastStatusMessages; }
function setLastStatusMessages(m) { lastStatusMessages = m; }

async function handleStatus(sock, msg, db) {
    if (!sock) return;

    try {
        const { key } = msg;
        if (key.fromMe) return;

        const p = key.participant || key.remoteJid;
        if (!p || p === sock.user?.id) return;

        if (key.remoteJid !== 'status@broadcast') return;

        const participantNum = p.split('@')[0];

        if (Date.now() - lastStatusTime < 2000) return;
        lastStatusTime = Date.now();

        const messages = getLastStatusMessages();
        messages.push({ msg, timestamp: Date.now(), participant: p });
        if (messages.length > 50) messages.shift();
        setLastStatusMessages(messages);

        const msgType = Object.keys(msg.message || {})[0] || 'text';
        const typeEmoji = msgType.includes('image') ? '🖼️' :
                         msgType.includes('video') ? '🎬' :
                         msgType.includes('audio') ? '🎵' : '💬';

        console.log('');
        console.log('┌──────────────────────────────────────────┐');
        console.log(`│  📱 STATUS RECEIVED                       │`);
        console.log('├──────────────────────────────────────────┤');
        console.log(`│  👤 From : +${participantNum}`);
        console.log(`│  ${typeEmoji} Type : ${msgType}`);
        console.log(`│  🕐 Time : ${new Date().toLocaleTimeString()}`);
        console.log('├──────────────────────────────────────────┤');

        // ═══════════════════════════════════════
        // 👁️ AUTO VIEW STATUS (REMOVED - handled in botClient.js)
        // ═══════════════════════════════════════
        // Auto-view is now handled in botClient.js
        console.log(`│  👁️ VIEWED ✅ (handled in botClient)`);

        // ═══════════════════════════════════════
        // 💬 AUTO REACT TO STATUS (OPTIONAL - disabled by default)
        // ═══════════════════════════════════════
        const autoReact = await db.get('autoStatusReact', false);
        if (autoReact) {
            const emoji = STATUS_EMOJIS[Math.floor(Math.random() * STATUS_EMOJIS.length)];
            try {
                await sock.sendMessage(
                    'status@broadcast',
                    { react: { text: emoji, key } },
                    { broadcast: true, statusJidList: [p] }
                );
                statusReactCount++;
                console.log(`│  💬 REACTED ${emoji} (Total: ${statusReactCount})`);
            } catch (e) {
                console.log(`│  ⚠️ React failed: ${e.message}`);
            }
        } else {
            console.log('│  ⚪ React: OFF');
        }

        // ═══════════════════════════════════════
        // 💾 AUTO SAVE STATUS MEDIA
        // ═══════════════════════════════════════
        const autoSave = await db.get('autoStatusSave', false);
        if (autoSave) {
            try {
                const message = msg.message || {};
                const hasMedia = message.imageMessage || message.videoMessage || message.audioMessage;
                
                if (hasMedia) {
                    const saved = await saveMediaToFile(msg, STATUS_FOLDER);
                    if (saved) {
                        statusSaveCount++;
                        console.log(`│  💾 AUTO SAVED ${saved.filename} (Total: ${statusSaveCount})`);
                        
                        // Send back to the user who posted the status
                        try {
                            const buffer = await getStatusMedia(msg);
                            if (buffer) {
                                if (msgType === 'imageMessage') {
                                    await sock.sendMessage(p, {
                                        image: buffer,
                                        caption: `📸 *STATUS AUTO SAVED*\n✅ Saved from your status!\n📁 Size: ${(buffer.length / 1024).toFixed(1)} KB`
                                    });
                                } else if (msgType === 'videoMessage') {
                                    await sock.sendMessage(p, {
                                        video: buffer,
                                        caption: `🎬 *STATUS AUTO SAVED*\n✅ Saved from your status!\n📁 Size: ${(buffer.length / 1024).toFixed(1)} KB`
                                    });
                                } else if (msgType === 'audioMessage') {
                                    await sock.sendMessage(p, {
                                        audio: buffer,
                                        mimetype: 'audio/mp4',
                                        caption: `🎵 *STATUS AUTO SAVED*\n✅ Saved from your status!`
                                    });
                                }
                            }
                        } catch (e) {
                            console.log(`│  ⚠️ Could not send back to user: ${e.message}`);
                        }
                    }
                }
            } catch (e) {
                console.log(`│  ⚠️ Auto save failed: ${e.message}`);
            }
        } else {
            console.log('│  ⚪ Auto Save: OFF');
        }

        console.log('└──────────────────────────────────────────┘');
        console.log('');

    } catch (e) {
        console.log('❌ Status error:', e.message);
    }
}

function getStatusStats() {
    return {
        viewed: statusViewCount,
        reacted: statusReactCount,
        saved: statusSaveCount
    };
}

module.exports = { 
    handleStatus, 
    getLastStatusMessages, 
    setLastStatusMessages, 
    getStatusStats 
};
