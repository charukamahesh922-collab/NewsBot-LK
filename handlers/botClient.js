// handlers/botClient.js

const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const config = require('../config');
const { db } = require('../utils/db');

// Force fresh require to avoid circular dependency issues
const helpers = require('../utils/helpers');
const setSock = helpers.setSock;
const setOwnerJid = helpers.setOwnerJid;
const setOwnerNumbers = helpers.setOwnerNumbers;
const getSock = helpers.getSock;

const { handleMessage } = require('./messageHandler');
const { handleStatus } = require('./statusHandler');
const { handleGroupUpdate } = require('./groupHandler');
const { handleButtonResponse } = require('../menus/buttonMenu');

// =============================================
// 🛡️ MESSAGE DEDUPLICATION
// =============================================

const processedMessages = new Set();
const MAX_CACHE_SIZE = 1000;

function isMessageProcessed(msgId) {
    if (!msgId) return false;
    if (processedMessages.has(msgId)) return true;
    
    processedMessages.add(msgId);
    if (processedMessages.size > MAX_CACHE_SIZE) {
        const arr = [...processedMessages];
        arr.slice(0, 500).forEach(id => processedMessages.delete(id));
    }
    return false;
}

// =============================================
// 💝 STATUS REACT EMOJIS
// =============================================

const STATUS_REACTIONS = ['❤️', '🔥', '😍', '👏', '💯', '🦄', '😎', '🥰'];

function getRandomReaction() {
    return STATUS_REACTIONS[Math.floor(Math.random() * STATUS_REACTIONS.length)];
}

// =============================================
// BOT START
// =============================================

const OWNER_NUMBERS = Array.isArray(config.ownerNumber) ? config.ownerNumber : [config.ownerNumber];
const CHECK_INTERVAL_MS = config.checkIntervalMs || 120000;
let sock = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let isShuttingDown = false;
let pairCodeRequested = false;

// Debug check
if (typeof setOwnerNumbers !== 'function') {
    console.error('❌ CRITICAL: setOwnerNumbers is not a function!');
    console.error('Type:', typeof setOwnerNumbers);
    console.error('Available exports:', Object.keys(helpers));
    process.exit(1);
}

setOwnerNumbers(OWNER_NUMBERS);

async function startBot() {
    if (sock) {
        try {
            sock.end();
        } catch (error) {
            console.error('Error ending socket:', error.message);
        }
        sock = null;
    }

    const baileys = await import('@whiskeysockets/baileys');
    const { 
        default: makeWASocket, 
        useMultiFileAuthState, 
        DisconnectReason, 
        Browsers, 
        fetchLatestBaileysVersion, 
        isJidNewsletter 
    } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(
        path.join(__dirname, '..', 'auth_info_baileys')
    );

    const { version } = await fetchLatestBaileysVersion();
    const loginMethod = config.loginMethod || 'qr';

    sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS('Chrome'),
        markOnlineOnConnect: true,
        connectTimeoutMs: 30000,
        printQRInTerminal: false,
        syncFullHistory: false,
        retryRequestDelayMs: 5000,
        maxRetries: 5,
        defaultQueryTimeoutMs: 60000,
        generateHighQualityLinkPreview: false,
        version: version,
        shouldIgnoreJid: (jid) => isJidNewsletter(jid),
    });

    setSock(sock);

    if (sock.user) {
        setOwnerJid(sock.user.id.replace(/:.*/, '') + '@s.whatsapp.net');
    }

    // =============================================
    // MESSAGE HANDLER
    // =============================================
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            try {
                if (!msg.message) continue;

                // Prevent duplicate processing
                const msgId = msg.key?.id;
                if (isMessageProcessed(msgId)) {
                    console.log(`⏭️ Skipping duplicate message: ${msgId}`);
                    continue;
                }

                const jid = msg.key?.remoteJid;
                if (!jid) continue;

                const sender = msg.key?.participant || jid;
                const senderNum = sender?.split('@')[0] || 'unknown';
                
                const msgText = msg.message?.conversation || 
                               msg.message?.extendedTextMessage?.text || 
                               msg.message?.imageMessage?.caption || 
                               msg.message?.videoMessage?.caption || '';

                // Skip empty messages (no text and no media)
                if (!msgText && !msg.message?.imageMessage && !msg.message?.videoMessage) {
                    continue;
                }

                const logText = msgText ? msgText.substring(0, 50) : '[media]';
                console.log(`📨 [${jid.endsWith('@g.us') ? 'GROUP' : 'DM'}] ${senderNum}: "${logText}"`);

                // =============================================
                // 👁️ STATUS AUTO-VIEW + AUTO-REACT (WITH TOGGLE)
                // =============================================
                if (jid === 'status@broadcast') {
                    try {
                        // Check if auto status view is enabled
                        const autoViewEnabled = await db.get('autoStatusView', true);
                        const autoReactEnabled = await db.get('autoStatusReact', true);

                        // Skip if it's not a media status (encryption key messages etc.)
                        const hasMedia = msg.message?.imageMessage || 
                                        msg.message?.videoMessage || 
                                        msg.message?.audioMessage;
                        
                        if (!hasMedia) {
                            // Still view it but don't react
                            if (autoViewEnabled) {
                                await sock.readMessages([msg.key]);
                                console.log(`👁️ Status viewed (no media) from ${senderNum}`);
                            }
                            await handleStatus(sock, msg, db);
                            continue;
                        }

                        // Auto-view status
                        if (autoViewEnabled) {
                            await sock.readMessages([msg.key]);
                            console.log(`👁️ Status viewed from ${senderNum}`);
                        }

                        // Auto-react to status
                        if (autoReactEnabled && autoViewEnabled) {
                            const emoji = getRandomReaction();
                            await sock.sendMessage(jid, {
                                react: {
                                    text: emoji,
                                    key: msg.key
                                }
                            });
                            console.log(`💝 Status reacted ${emoji} to ${senderNum}`);
                        }

                        await handleStatus(sock, msg, db);
                    } catch (error) {
                        // Ignore "not-acceptable" errors (already reacted/viewed)
                        if (error.message !== 'not-acceptable') {
                            console.error('❌ Status auto-view/react error:', error.message);
                        }
                    }
                    continue;
                }

                // Handle button responses
                if (msg.message?.listResponseMessage || 
                    msg.message?.buttonsResponseMessage || 
                    msg.message?.templateButtonReplyMessage) {
                    try {
                        await handleButtonResponse(sock, msg, jid, db, config, {
                            news: async (jid, index) => {
                                const { sendNewsCommand } = require('../commands/general');
                                await sendNewsCommand(sock, jid, db, index);
                            },
                            stats: async (jid) => {
                                const { handleStatsCommand } = require('../commands/general');
                                await handleStatsCommand(sock, jid, db);
                            },
                            isGroup: jid.endsWith('@g.us'),
                            isOwner: false,
                            isAdmin: false
                        });
                    } catch (error) {
                        console.error('Button response error:', error.message);
                    }
                    continue;
                }

                console.log('➡️ Sending to handleMessage...');
                await handleMessage(sock, msg, db, config);

            } catch (error) {
                console.error('❌ Message error:', error.message);
            }
        }
    });

    // =============================================
    // GROUP PARTICIPANTS UPDATE
    // =============================================
    sock.ev.on('group-participants.update', async (update) => {
        try {
            await handleGroupUpdate(sock, update, db);
        } catch (error) {
            console.error('Group update error:', error.message);
        }
    });

    // =============================================
    // AUTO REJECT CALLS
    // =============================================
    sock.ev.on('call', async (calls) => {
        for (const call of calls) {
            if (call.status === 'offer') {
                try {
                    await sock.rejectCall(call.id, call.from);
                    console.log(`📵 Rejected call from ${call.from}`);
                } catch (error) {
                    console.error('Reject call error:', error.message);
                }
            }
        }
    });

    // =============================================
    // CONNECTION UPDATE HANDLER
    // =============================================
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code login
        if (qr && loginMethod === 'qr') {
            console.log('\n📱 Scan QR Code:\n');
            qrcode.generate(qr, { small: true });
        }

        // Pairing code login
        if (loginMethod === 'pair' && !pairCodeRequested && (connection === 'connecting' || !!qr)) {
            pairCodeRequested = true;
            try {
                const phoneNumber = (config.pairPhoneNumber || config.ownerNumber[0]).replace(/[+\s-]/g, '');
                const code = await sock.requestPairingCode(phoneNumber);
                console.log('\n╔══════════════════════════════════════╗');
                console.log('║       📱 *PAIR CODE LOGIN*           ║');
                console.log(`║     Your Code: *${code}*              ║`);
                console.log('╚══════════════════════════════════════╝\n');
            } catch (error) {
                console.error('Pairing code error:', error.message);
                pairCodeRequested = false;
            }
        }

        // Connection closed
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            // Logged out - delete auth and restart
            if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
                console.log('⚠️ Logged out! Deleting auth files...');
                try {
                    const authPath = path.join(__dirname, '..', 'auth_info_baileys');
                    if (fs.existsSync(authPath)) {
                        fs.rmSync(authPath, { recursive: true, force: true });
                    }
                } catch (error) {
                    console.error('Error deleting auth:', error.message);
                }
                pairCodeRequested = false;
                setTimeout(() => startBot(), 3000);
                return;
            }

            // Reconnect with delay
            if (!isShuttingDown && shouldReconnect) {
                reconnectAttempts++;
                const delay = Math.min(30000, 2000 * reconnectAttempts);
                console.log(`🔄 Reconnecting in ${delay / 1000}s... (Attempt ${reconnectAttempts})`);
                
                reconnectTimer = setTimeout(() => {
                    reconnectTimer = null;
                    pairCodeRequested = false;
                    if (!isShuttingDown) {
                        startBot();
                    }
                }, delay);
            }
        }

        // Connected successfully
        if (connection === 'open') {
            reconnectAttempts = 0;
            pairCodeRequested = false;
            console.log('\n💝 Connected! 👑 Owners: ' + OWNER_NUMBERS.join(', ') + '\n');

            // Initialize default settings
            try {
                const autoViewSet = await db.get('autoStatusView', 'NOT_SET');
                if (autoViewSet === 'NOT_SET') await db.set('autoStatusView', true);
                
                const autoReactSet = await db.get('autoStatusReact', 'NOT_SET');
                if (autoReactSet === 'NOT_SET') await db.set('autoStatusReact', true);
                
                console.log('👁️ Auto Status View: ' + (await db.get('autoStatusView') ? '✅ ON' : '❌ OFF'));
                console.log('💝 Auto Status React: ' + (await db.get('autoStatusReact') ? '✅ ON' : '❌ OFF'));
            } catch (e) {}

            // Send connected message
            try {
                const { sendConnectedMessage } = require('../commands/owner');
                await sendConnectedMessage(sock, db, config);
            } catch (error) {
                console.error('Connected message error:', error.message);
            }

            // Auto news if enabled
            try {
                const autoNewsEnabled = await db.get('autoNewsEnabled', false);
                if (autoNewsEnabled) {
                    const { checkAndShareAllNewNews } = require('../commands/general');
                    await checkAndShareAllNewNews(sock, db, config);
                    
                    setInterval(async () => {
                        try {
                            const stillEnabled = await db.get('autoNewsEnabled', false);
                            if (stillEnabled) {
                                await checkAndShareAllNewNews(sock, db, config);
                            }
                        } catch (error) {
                            console.error('Auto news interval error:', error.message);
                        }
                    }, CHECK_INTERVAL_MS);
                }
            } catch (error) {
                console.error('Auto news setup error:', error.message);
            }
        }
    });

    // Save credentials
    sock.ev.on('creds.update', saveCreds);
}

// =============================================
// GRACEFUL SHUTDOWN
// =============================================
function shutdown() {
    isShuttingDown = true;
    
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    if (sock) {
        try {
            sock.end();
        } catch (error) {
            console.error('Error during shutdown:', error.message);
        }
        sock = null;
    }
    
    console.log('👋 Bot shut down gracefully');
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// =============================================
// EXPORTS
// =============================================
module.exports = { 
    startBot, 
    shutdown 
};
