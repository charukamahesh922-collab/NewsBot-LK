// handlers/messageHandler.js

const { jidDecode, jidNormalizedUser } = require('@whiskeysockets/baileys');
const { isOwner, checkAdmin, getSock, getOwnerNumbers, getOwnerJid, saveMediaToFile, getStatusMedia } = require('../utils/helpers');
const { db } = require('../utils/db');
const { 
    handleMenuCommand, handleStatsCommand, sendNewsCommand, 
    handleAboutCommand, handleHelpCommand, handlePingCommand, 
    handleTimeCommand, handleWeatherCommand, handleTextTools,
    handleEditCommand, handleReactCommand, handleDocumentCommand,
    handleSearchCommand, handleMyPpCommand, handleMyAboutCommand
} = require('../commands/general');
const { handleOwnerCommands } = require('../commands/owner');
const { handleAdminCommands } = require('../commands/admin');
const { handleGroupCommands } = require('../commands/group');
const { handleMediaCommands } = require('../commands/media');
const { handleVoiceReply, handleVoiceCommands } = require('../commands/voice');
const { handleDownloaderCommands } = require('../commands/downloader');
const { sendSettingsMenu } = require('../menus/settingsMenu');
const { handleSettingsCommands } = require('../menus/settingsMenu');
const { sendButtonMenu, sendListMenu } = require('../menus/buttonMenu');

const { handleStatus, getStatusStats, getLastStatusMessages } = require('../handlers/statusHandler');
const { STATUS_FOLDER } = require('../utils/constants');

const processedMessages = new Set();
const MAX_CACHE_SIZE = 1000;

async function handleMessage(sock, msg, db, config) {
    try {
        if (!msg.message) return;

        const jid = msg.key?.remoteJid;
        if (!jid) return;

        const msgId = msg.key?.id;
        if (msgId) {
            if (processedMessages.has(msgId)) return;
            processedMessages.add(msgId);
            if (processedMessages.size > MAX_CACHE_SIZE) {
                const arr = [...processedMessages];
                arr.slice(0, 500).forEach(id => processedMessages.delete(id));
            }
        }

        const rawSender = msg.key?.participant || jid;
        if (!rawSender || typeof rawSender !== 'string') return;

        const sender = jidNormalizedUser(rawSender);
        const decoded = jidDecode(sender);
        if (!decoded) return;

        const senderNum = decoded.user;
        const isGroup = jid.endsWith('@g.us');

        const rawText = msg.message?.conversation 
            || msg.message?.extendedTextMessage?.text 
            || msg.message?.imageMessage?.caption 
            || msg.message?.videoMessage?.caption 
            || '';

        if (!rawText) return;

        const text = rawText.trim();
        const lower = text.toLowerCase();

        console.log(`📩 [${isGroup ? 'GROUP' : 'DM'}] ${senderNum}: "${text.substring(0, 60)}"`);

        const ownerNumbers = getOwnerNumbers();
        const ownerJid = getOwnerJid();
        const isUserOwner = isOwner(senderNum, sender, ownerNumbers, ownerJid);
        
        let isAdmin = false;
        if (isGroup) {
            try { 
                isAdmin = await checkAdmin(sock, jid, sender); 
            } catch (e) {
                console.error('Admin check error:', e.message);
            }
        }

        try { if (await db.banCheck(sender) && !isUserOwner) return; } catch (e) {}

        try {
            const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            for (const m of mentioned) {
                const afk = await db.afkGet(m);
                if (afk) await sock.sendMessage(jid, { text: `💤 @${m.split('@')[0]} is AFK: ${afk.reason}`, mentions: [m] });
            }
        } catch (e) {}

        try {
            if (await db.afkGet(sender) && !lower.startsWith('.afk')) {
                await db.afkRemove(sender);
                await sock.sendMessage(jid, { text: `👋 Welcome back @${senderNum}! AFK removed.`, mentions: [sender] });
            }
        } catch (e) {}

        if (!isGroup) {
            try {
                const voiceHandled = await handleVoiceReply(sock, jid, text, msg, isUserOwner, db);
                if (voiceHandled) return;
            } catch (e) {}
        }

        if (lower === '.testcmds' || lower === 'testcmds') {
            if (isUserOwner) {
                const { runTests } = require('../test/testCommands');
                await sock.sendMessage(jid, { text: '🧪 *Starting command tests...*' });
                await runTests(sock, jid);
            } else {
                await sock.sendMessage(jid, { text: '❌ *Owner only!*' });
            }
            return;
        }

        // ════════════════════════════════
        // 📱 STATUS COMMANDS
        // ════════════════════════════════

                       if (lower === '.save') {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            
            if (contextInfo?.remoteJid === 'status@broadcast') {
                if (!contextInfo?.stanzaId) {
                    await sock.sendMessage(jid, { text: '💡 Reply to a status with `.save`' });
                    return;
                }
                
                await sock.sendMessage(jid, { text: '⏳ *Downloading status...*' });
                
                try {
                    // Build message from the QUOTED status content
                    const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    
                    if (!quotedMessage) {
                        await sock.sendMessage(jid, { text: '❌ *No media found in reply!*' });
                        return;
                    }

                    const statusMsg = {
                        key: {
                            remoteJid: 'status@broadcast',
                            id: contextInfo.stanzaId,
                            participant: contextInfo.participant
                        },
                        message: quotedMessage
                    };

                    const buffer = await getStatusMedia(statusMsg);
                    
                    if (!buffer || buffer.length < 100) {
                        await sock.sendMessage(jid, { text: '❌ *Could not download! Status may have expired.*' });
                        return;
                    }

                    const hasImage = quotedMessage?.imageMessage;
                    const hasVideo = quotedMessage?.videoMessage;
                    const hasAudio = quotedMessage?.audioMessage;
                    const fromUser = contextInfo.participant?.split('@')[0] || 'unknown';
                    const sizeKB = (buffer.length / 1024).toFixed(1);

                    if (hasImage) {
                        await sock.sendMessage(jid, { 
                            image: buffer,
                            caption: `📸 *Saved!*\n👤 @${fromUser}\n📁 ${sizeKB} KB`,
                            mentions: [contextInfo.participant]
                        });
                    } else if (hasVideo) {
                        await sock.sendMessage(jid, { 
                            video: buffer,
                            caption: `🎬 *Saved!*\n👤 @${fromUser}\n📁 ${sizeKB} KB`,
                            mentions: [contextInfo.participant]
                        });
                    } else if (hasAudio) {
                        await sock.sendMessage(jid, { 
                            audio: buffer,
                            mimetype: 'audio/mp4',
                            ptt: quotedMessage.audioMessage?.ptt || false
                        });
                        await sock.sendMessage(jid, { 
                            text: `🎵 *Saved!*\n👤 @${fromUser}\n📁 ${sizeKB} KB`,
                            mentions: [contextInfo.participant]
                        });
                    } else {
                        await sock.sendMessage(jid, { 
                            document: buffer,
                            fileName: `status_${Date.now()}`,
                            caption: `💾 *Saved!*\n👤 @${fromUser}\n📁 ${sizeKB} KB`,
                            mentions: [contextInfo.participant]
                        });
                    }
                } catch (error) {
                    console.error('❌ Save status error:', error);
                    await sock.sendMessage(jid, { text: '❌ *Failed!*' });
                }
                return;
            }
            
            await sock.sendMessage(jid, { text: '💡 Reply to a status with `.save`' });
            return;
        }

                if (lower === '.savetome') {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            
            if (!contextInfo?.stanzaId || contextInfo?.remoteJid !== 'status@broadcast') {
                await sock.sendMessage(jid, { text: '💡 Reply to a status with `.savetome`' });
                return;
            }
            
            await sock.sendMessage(jid, { text: '⏳ *Downloading status to DM...*' });
            
            try {
                let buffer = await getStatusMedia(msg);
                
                if (!buffer || buffer.length < 100) {
                    const statusMsg = {
                        key: { remoteJid: 'status@broadcast', id: contextInfo.stanzaId, participant: contextInfo.participant },
                        message: contextInfo.quotedMessage || {}
                    };
                    buffer = await getStatusMedia(statusMsg);
                }
                
                if (!buffer || buffer.length < 100) {
                    await sock.sendMessage(jid, { text: '❌ *Could not download!*' });
                    return;
                }

                const hasImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
                    || contextInfo?.quotedMessage?.imageMessage;
                const hasVideo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage
                    || contextInfo?.quotedMessage?.videoMessage;
                const fromUser = contextInfo.participant?.split('@')[0] || 'unknown';
                const sizeKB = (buffer.length / 1024).toFixed(1);

                if (hasImage) {
                    await sock.sendMessage(sender, { image: buffer, caption: `📸 Status from @${fromUser}\n📁 ${sizeKB} KB` });
                } else if (hasVideo) {
                    await sock.sendMessage(sender, { video: buffer, caption: `🎬 Status from @${fromUser}\n📁 ${sizeKB} KB` });
                } else {
                    await sock.sendMessage(sender, { document: buffer, fileName: `status_${Date.now()}`, caption: `💾 Status from @${fromUser}\n📁 ${sizeKB} KB` });
                }

                await sock.sendMessage(jid, { text: `📥 *Sent to DM!*\n👤 @${fromUser}\n📁 ${sizeKB} KB`, mentions: [contextInfo.participant] });
            } catch (error) {
                console.error('Save to DM error:', error);
                await sock.sendMessage(jid, { text: '❌ *Failed!*' });
            }
            return;
        }

        if (lower === '.statusstats') {
            const stats = getStatusStats();
            const lastStatuses = getLastStatusMessages();
            await sock.sendMessage(jid, { text: `📊 *STATUS STATS*\n👁️ Viewed: ${stats.viewed}\n💬 Reacted: ${stats.reacted}\n💾 Saved: ${stats.saved}\n📱 Cached: ${lastStatuses.length}` });
            return;
        }

        if (lower === '.autostatus on') {
            if (!isUserOwner) { await sock.sendMessage(jid, { text: '❌ *Owner only!*' }); return; }
            await db.set('autoStatusView', true);
            await db.set('autoStatusReact', true);
            await sock.sendMessage(jid, { text: '👁️ *Auto Status: ON*' });
            return;
        }

        if (lower === '.autostatus off') {
            if (!isUserOwner) { await sock.sendMessage(jid, { text: '❌ *Owner only!*' }); return; }
            await db.set('autoStatusView', false);
            await db.set('autoStatusReact', false);
            await sock.sendMessage(jid, { text: '👁️ *Auto Status: OFF*' });
            return;
        }

        if (lower === '.autostatussave on') {
            if (!isUserOwner) { await sock.sendMessage(jid, { text: '❌ *Owner only!*' }); return; }
            await db.set('autoStatusSave', true);
            await sock.sendMessage(jid, { text: '💾 *Auto Save: ON*' });
            return;
        }

        if (lower === '.autostatussave off') {
            if (!isUserOwner) { await sock.sendMessage(jid, { text: '❌ *Owner only!*' }); return; }
            await db.set('autoStatusSave', false);
            await sock.sendMessage(jid, { text: '💾 *Auto Save: OFF*' });
            return;
        }

        // ════════════════════════════════
        // COMMAND ROUTING
        // ════════════════════════════════

        if (['.menu', 'menu', '.help', 'help', '.list', 'list'].includes(lower)) {
            await handleMenuCommand(sock, jid, db, config, isUserOwner, isAdmin, isGroup);
            return;
        }
        if (['.buttons', 'buttons', '.btn', 'btn'].includes(lower)) { await sendButtonMenu(sock, jid, db, config, isUserOwner, isAdmin); return; }
        if (['.listmenu', 'listmenu', '.lmenu', 'lmenu'].includes(lower)) { await sendListMenu(sock, jid); return; }
        if (['.settings', 'settings'].includes(lower)) {
            if (isUserOwner) await sendSettingsMenu(sock, jid, db, isUserOwner, config);
            else await sock.sendMessage(jid, { text: '❌ *Owner only!*' });
            return;
        }
        if (['.stats', 'stats'].includes(lower)) { await handleStatsCommand(sock, jid, db, config); return; }
        if (['.news', 'news'].includes(lower)) { await sendNewsCommand(sock, jid, db, isGroup); return; }
        if (['.about', 'about'].includes(lower)) { await handleAboutCommand(sock, jid, config); return; }
        if (['.ping', 'ping'].includes(lower)) { await handlePingCommand(sock, jid); return; }
        if (['.time', 'time'].includes(lower)) { await handleTimeCommand(sock, jid); return; }
        if (lower.startsWith('.weather') || lower.startsWith('weather')) { await handleWeatherCommand(sock, jid, text); return; }

        const mediaCmds = ['.vv', '.sticker', '.s', '.toimg', '.togif', '.emoji', '.removebg', '.nobg', '.gif', '.ptv', '.qs', '.document'];
        if (mediaCmds.includes(lower) || mediaCmds.some(c => lower.startsWith(c + ' '))) {
            await handleMediaCommands(sock, msg, jid, text, lower, sender, db, lower.split(' ')[0].replace('.', ''));
            return;
        }

        if (['.upper', '.lower', '.reverse', '.count'].includes(lower) || lower.startsWith('.upper ') || lower.startsWith('.lower ') || lower.startsWith('.reverse ') || lower.startsWith('.count ')) {
            await handleTextTools(sock, jid, text, lower.split(' ')[0].replace('.', ''));
            return;
        }

        if (lower.startsWith('.edit ') || lower.startsWith('edit ')) { await handleEditCommand(sock, msg, jid, text); return; }
        if (lower.startsWith('.react ') || lower.startsWith('react ')) { await handleReactCommand(sock, msg, jid, text); return; }
        if (lower.startsWith('.search ') || lower.startsWith('search ')) { await handleSearchCommand(sock, jid, text); return; }
        if (lower === '.mypp' || lower === 'mypp') { await handleMyPpCommand(sock, jid); return; }
        if (lower === '.myabout' || lower === 'myabout') { await handleMyAboutCommand(sock, jid); return; }
        if (lower === '.typing' || lower === 'typing') { await sock.sendPresenceUpdate('composing', jid); return; }
        if (lower === '.recording' || lower === 'recording') { await sock.sendPresenceUpdate('recording', jid); return; }
        if (lower === '.online' || lower === 'online') { await sock.sendPresenceUpdate('available', jid); return; }
        if (lower === '.offline' || lower === 'offline') { await sock.sendPresenceUpdate('unavailable', jid); return; }

        if (lower === '.getpp' || lower === 'getpp') {
            try {
                const ppUrl = await sock.profilePictureUrl(jid, 'image');
                await sock.sendMessage(jid, { image: { url: ppUrl }, caption: `🖼️ @${senderNum}`, mentions: [sender] });
            } catch { await sock.sendMessage(jid, { text: '❌ *No profile picture!*' }); }
            return;
        }

        if (lower.startsWith('.getpp ') || lower.startsWith('getpp ')) {
            const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            let target;
            if (mentioned.length > 0) { target = mentioned[0]; }
            else { const num = text.replace(/^\.?getpp\s+/, '').trim().replace(/[^0-9]/g, ''); if (num) target = num + '@s.whatsapp.net'; }
            if (!target) { await sock.sendMessage(jid, { text: '💡 *.getpp @user*' }); return; }
            try {
                const ppUrl = await sock.profilePictureUrl(target, 'image');
                await sock.sendMessage(jid, { image: { url: ppUrl }, caption: `🖼️ @${target.split('@')[0]}`, mentions: [target] });
            } catch { await sock.sendMessage(jid, { text: '❌ *No profile picture!*' }); }
            return;
        }

        // ════════════════════════════════
        // ⬇️ DOWNLOADER COMMANDS
        // ════════════════════════════════
        const dlCmds = ['.yt', '.ytmp3', '.ytmp4', '.ig', '.fb', '.tt', '.pin', '.google'];
        if (dlCmds.some(c => lower.startsWith(c + ' ') || lower === c)) {
            await handleDownloaderCommands(sock, msg, jid, text, lower, sender, db);
            return;
        }

        // ════════════════════════════════
        // OWNER COMMANDS
        // ════════════════════════════════
        if (isUserOwner) {
            const voiceCmdHandled = await handleVoiceCommands(sock, msg, jid, text, lower, sender, db, isUserOwner);
            if (voiceCmdHandled) return;
            const settingsHandled = await handleSettingsCommands(sock, msg, jid, text, lower, sender, db, isUserOwner);
            if (settingsHandled) return;
            await handleOwnerCommands(sock, msg, jid, text, lower, sender, db, config);
        }

        // GROUP COMMANDS
        // ════════════════════════════════
        if (isGroup) {
            await handleGroupCommands(sock, msg, jid, text, lower, sender, db, isAdmin, isUserOwner);
            if (isAdmin || isUserOwner) {
                await handleAdminCommands(sock, msg, jid, text, lower, sender, db);
            }
            return;
        }

    } catch (error) {
        console.error('❌ Handler error:', error.message);
        try { if (msg?.key?.remoteJid) await sock.sendMessage(msg.key.remoteJid, { text: '❌ *Error!*' }); } catch (e) {}
    }
}  // ← THIS CLOSES handleMessage

module.exports = { handleMessage };
