// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                         ║
// ║                🦄 Beautiful Edition 🦄                      ║
// ║              Developed by Charuka Mahesh                     ║
// ║     Dedicated to Umesha Sathyanjali | Mithila | Sharada      ║
// ║                  Version: 9.0.4 ✨                            ║
// ╚══════════════════════════════════════════════════════════════╝

const { startBot } = require('./handlers/botClient');
const { connectDatabase } = require('./utils/db');
const config = require('./config');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════
// 🔇 SUPPRESS BAILEYS VERBOSE LOGS
// ═══════════════════════════════════════════════
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('"class":"baileys"') ||
        msg.includes('"level":') ||
        msg.includes('Bad MAC') ||
        msg.includes('MessageCounterError') ||
        msg.includes('Key used already') ||
        msg.includes('failed to decrypt') ||
        msg.includes('No matching sessions') ||
        msg.includes('SessionError') ||
        msg.includes('Closing session') ||
        msg.includes('SessionEntry') ||
        msg.includes('sent retry receipt') ||
        msg.includes('uploading pre-keys') ||
        msg.includes('uploaded pre-keys') ||
        msg.includes('offline preview') ||
        msg.includes('handled') && msg.includes('offline') ||
        msg.includes('History sync') ||
        msg.includes('AwaitingInitialSync') ||
        msg.includes('pre-keys found') ||
        msg.includes('Failed to decrypt') ||
        msg.includes('Input file contains unsupported') ||
        msg.includes('failed to obtain extra info') ||
        msg.includes('Sharp.metadata') ||
        msg.includes('received error in ack') ||
        msg.includes('Timed Out') ||
        msg.includes('unexpected error') ||
        msg.includes('init queries') ||
        msg.includes('fetchProps') ||
        msg.includes('waitForMessage') ||
        msg.includes('Closing open session') ||
        msg.includes('Removing old closed session') ||
        msg.includes('_chains') ||
        msg.includes('registrationId') ||
        msg.includes('currentRatchet') ||
        msg.includes('ephemeralKeyPair') ||
        msg.includes('indexInfo') ||
        msg.includes('baseKey') ||
        msg.includes('rootKey') ||
        msg.includes('lastRemote') ||
        msg.includes('privKey') ||
        msg.includes('pubKey') ||
        msg.includes('remoteIdentityKey') ||
        msg.includes('Received message with old counter') ||
        msg.includes('Fetching Cricinfo') ||
        msg.includes('Fetching BBC') ||
        msg.includes('Fetching Helakuru') ||
        msg.includes('Fetching SL cricket') ||
        msg.includes('Fetching Sporty') ||
        msg.includes('Fetching Mawbima') ||
        msg.includes('Got data from') ||
        msg.includes('Got HTML from') ||
        msg.includes('Scraping:') ||
        msg.includes('sample item') ||
        msg.includes('Esana API:') ||
        msg.includes('BBC RSS:') ||
        msg.includes('Request failed') ||
        msg.includes('Could not fetch') ||
        msg.startsWith('✅ BBC:') ||
        msg.startsWith('📱 Esana:') ||
        msg.startsWith('🏏 BBC Cricket:') ||
        msg.startsWith('⚽ BBC Football:') ||
        msg.startsWith('🏏 Sporty.lk:') ||
        msg.startsWith('🏏 ThePapare:') ||
        msg.startsWith('🏏 Added:') ||
        msg.startsWith('🌍 BBC Sinhala:') ||
        msg.startsWith('📰 Ada.lk:') ||
        msg.includes('chars]')) return;
    originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('Bad MAC') ||
        msg.includes('MessageCounterError') ||
        msg.includes('Key used already') ||
        msg.includes('failed to decrypt') ||
        msg.includes('No matching sessions') ||
        msg.includes('SessionError') ||
        msg.includes('Closing session') ||
        msg.includes('SessionEntry') ||
        msg.includes('Input file contains') ||
        msg.includes('failed to obtain extra info') ||
        msg.includes('Sharp.metadata') ||
        msg.includes('Timed Out') ||
        msg.includes('unexpected error') ||
        msg.includes('init queries')) return;
    originalConsoleError.apply(console, args);
};

// ═══════════════════════════════════════════════
// 🚀 MAIN
// ═══════════════════════════════════════════════
async function main() {
    console.log(`\n💝 NewsBot LK v${config.version || '9.0.4'}`);
    console.log(`👨‍💻 ${config.developer || 'Charuka Mahesh'}`);
    console.log(`👑 Owners: ${config.ownerNumber.join(', ')}`);
    console.log(`📰 News Group: ${config.newsGroupJid}`);
    console.log(`📱 Status Group: ${config.statusGroupJid || 'Not Set'}`);
    console.log('');

    // Connect database
    await connectDatabase();
    
    // Start bot (TikTok + News auto-start inside botClient)
    await startBot();
}

main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => { console.log('\n👋 Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n👋 Shutting down...'); process.exit(0); }); final improved version of tis
