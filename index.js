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

// List of log patterns to hide
const HIDDEN_PATTERNS = [
  // Baileys WhatsApp library logs
  '"class":"baileys"', '"level":', 'Bad MAC', 'MessageCounterError',
  'Key used already', 'failed to decrypt', 'No matching sessions',
  'SessionError', 'Closing session', 'SessionEntry', 'sent retry receipt',
  'uploading pre-keys', 'uploaded pre-keys', 'offline preview',
  'handled', 'offline', 'History sync', 'AwaitingInitialSync',
  'pre-keys found', 'Failed to decrypt', 'Input file contains unsupported',
  'failed to obtain extra info', 'Sharp.metadata', 'received error in ack',
  'Timed Out', 'unexpected error', 'init queries', 'fetchProps',
  'waitForMessage', 'Closing open session', 'Removing old closed session',
  '_chains', 'registrationId', 'currentRatchet', 'ephemeralKeyPair',
  'indexInfo', 'baseKey', 'rootKey', 'lastRemote', 'privKey', 'pubKey',
  'remoteIdentityKey', 'Received message with old counter',
  
  // News fetching logs
  'Fetching Cricinfo', 'Fetching BBC', 'Fetching Helakuru',
  'Fetching SL cricket', 'Fetching Sporty', 'Fetching Mawbima',
  'Got data from', 'Got HTML from', 'Scraping:', 'sample item',
  'Esana API:', 'BBC RSS:', 'Request failed', 'Could not fetch',
  
  // Success logs (optional - comment out to show them)
  'BBC:', 'Esana:', 'BBC Cricket:', 'BBC Football:',
  'Sporty.lk:', 'ThePapare:', 'Added:', 'BBC Sinhala:', 'Ada.lk:'
];

// Save original console functions
const originalLog = console.log;
const originalError = console.error;

// Override console.log
console.log = function(...args) {
  const msg = args.join(' ');
  const shouldHide = HIDDEN_PATTERNS.some(pattern => 
    msg.toLowerCase().includes(pattern.toLowerCase())
  );
  if (!shouldHide) {
    originalLog.apply(console, args);
  }
};

// Override console.error
console.error = function(...args) {
  const msg = args.join(' ');
  const shouldHide = HIDDEN_PATTERNS.some(pattern => 
    msg.toLowerCase().includes(pattern.toLowerCase())
  );
  if (!shouldHide) {
    originalError.apply(console, args);
  }
};

// ═══════════════════════════════════════════════
// 📱 TIKTOK AUTO-SEND CHECK
// ═══════════════════════════════════════════════

/**
 * Check if TikTok auto-send is enabled in config
 * If not, warn the user but continue
 */
function checkTikTokConfig() {
  const tiktokEnabled = config.tiktokAutoSend !== false;
  
  if (!tiktokEnabled) {
    console.warn('⚠️ TikTok auto-send is DISABLED in config');
    console.warn('   To enable, set config.tiktokAutoSend = true');
  } else {
    console.log('✅ TikTok auto-send is ENABLED');
  }
  
  return tiktokEnabled;
}

// ═══════════════════════════════════════════════
// 🚀 MAIN
// ═══════════════════════════════════════════════

async function main() {
  try {
    // Show startup banner
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  💝 NEWS BOT LK 💝                               ║');
    console.log(`║  🦄 Version: ${config.version || '9.0.4'}                          ║`);
    console.log(`║  👨‍💻 Developer: ${config.developer || 'Charuka Mahesh'}              ║`);
    console.log(`║  👑 Owners: ${config.ownerNumber?.join(', ') || 'N/A'}     ║`);
    console.log(`║  📰 News Group: ${config.newsGroupJid || 'N/A'}      ║`);
    console.log(`║  📱 Status Group: ${config.statusGroupJid || 'Not Set'}   ║`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    // Check TikTok config
    checkTikTokConfig();

    // Connect to database (with retry)
    let connected = false;
    let attempts = 3;

    while (!connected && attempts > 0) {
      try {
        await connectDatabase();
        connected = true;
        console.log('✅ Database connected successfully');
      } catch (error) {
        attempts--;
        console.error(`⚠️ Database connection failed (${attempts} retries left):`, error.message);
        if (attempts > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (!connected) {
      console.warn('⚠️ Running without database connection');
    }

    // Start the bot
    console.log('🚀 Starting News Bot...');
    console.log('📱 TikTok videos will be auto-sent to status group');
    console.log('');

    // Start the bot
    await startBot();

  } catch (error) {
    console.error('❌ Fatal error in main():', error.message);
    console.error('📚 Stack trace:', error.stack);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════
// 🔄 GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════

function gracefulShutdown(signal) {
  console.log(`\n👋 Received ${signal}. Shutting down gracefully...`);
  console.log('💝 Thank you for using News Bot LK!');
  process.exit(0);
}

// Handle termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  console.error('📚 Stack:', error.stack);
  // Don't exit - let the bot try to recover
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  // Don't exit - let the bot try to recover
});

// ═══════════════════════════════════════════════
// 🏁 START THE APPLICATION
// ═══════════════════════════════════════════════

main().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
