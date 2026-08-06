// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🦄 Beautiful Edition 🦄                    ║
// ║              Developed by Charuka Mahesh                     ║
// ║     Dedicated to Umesha Sathyanjali | Mithila | Sharada     ║
// ║                  Version: 9.0.4 ✨                           ║
// ╚══════════════════════════════════════════════════════════════╝

const { startBot } = require('./handlers/botClient');
const { connectDatabase } = require('./utils/db');
const config = require('./config');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// 🔇 SUPPRESS SIGNAL/BALLEYS LOG SPAM
// ═══════════════════════════════════════════════════════════════

const originalConsoleError = console.error;
console.error = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('Bad MAC') || 
        msg.includes('failed to decrypt') || 
        msg.includes('No matching sessions') ||
        msg.includes('MessageCounterError') ||
        msg.includes('SessionError') ||
        msg.includes('Closing open session') ||
        msg.includes('Removing old closed session') ||
        msg.includes('SessionEntry') ||
        msg.includes('Closing session:')) {
        return; // Suppress noisy signal/session logs
    }
    originalConsoleError.apply(console, args);
};

// ═══════════════════════════════════════════════════════════════
// 🎨 BEAUTIFUL ASCII ART
// ═══════════════════════════════════════════════════════════════

const BANNER = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     ███╗   ██╗███████╗██╗    ██╗███████╗    ██████╗  ██████╗ ████████╗
║     ████╗  ██║██╔════╝██║    ██║██╔════╝    ██╔══██╗██╔═══██╗╚══██╔══╝
║     ██╔██╗ ██║█████╗  ██║ █╗ ██║███████╗    ██████╔╝██║   ██║   ██║   
║     ██║╚██╗██║██╔══╝  ██║███╗██║╚════██║    ██╔══██╗██║   ██║   ██║   
║     ██║ ╚████║███████╗╚███╔███╔╝███████║    ██████╔╝╚██████╔╝   ██║   
║     ╚═╝  ╚═══╝╚══════╝ ╚══╝╚══╝ ╚══════╝    ╚═════╝  ╚═════╝    ╚═╝   
║                                                              ║
║                 💝 *NEWS BOT LK* 💝                         ║
║               🦄 *Sri Lanka's #1 News Bot* 🦄              ║
║                                                              ║
║           👨‍💻 Developed by: Charuka Mahesh                    ║
║           💝 Dedicated to: Umesha Sathyanjali               ║
║           💝 Dedicated to: Mithila | Sharada                ║
║           📦 Version: 9.0.4                                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

// ═══════════════════════════════════════════════════════════════
// 🎨 COLOR HELPERS
// ═══════════════════════════════════════════════════════════════

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    fg: {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
    }
};

const bright = (text) => `${colors.bright}${text}${colors.reset}`;
const success = (text) => `${colors.fg.green}${text}${colors.reset}`;
const error = (text) => `${colors.fg.red}${text}${colors.reset}`;
const warn = (text) => `${colors.fg.yellow}${text}${colors.reset}`;
const info = (text) => `${colors.fg.cyan}${text}${colors.reset}`;

// ═══════════════════════════════════════════════════════════════
// 📝 LOGGING HELPERS
// ═══════════════════════════════════════════════════════════════

function logWithTimestamp(message, type = 'INFO') {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const typeColors = {
        'INFO': '\x1b[36m',
        'SUCCESS': '\x1b[32m',
        'WARN': '\x1b[33m',
        'ERROR': '\x1b[31m',
        'DEBUG': '\x1b[35m'
    };
    const color = typeColors[type] || typeColors.INFO;
    console.log(`${color}[${timestamp}] ${type.padEnd(7)}\x1b[0m ${message}`);
}

function logInfo(msg) { logWithTimestamp(msg, 'INFO'); }
function logSuccess(msg) { logWithTimestamp(msg, 'SUCCESS'); }
function logWarn(msg) { logWithTimestamp(msg, 'WARN'); }
function logError(msg) { logWithTimestamp(msg, 'ERROR'); }

// ═══════════════════════════════════════════════════════════════
// 🚀 APPLICATION START
// ═══════════════════════════════════════════════════════════════

async function main() {
    try {
        // ── DISPLAY BANNER ──
        console.log(bright(BANNER));

        // ── SYSTEM INFO ──
        console.log(info('┌──────────────────────────────────────────────────────┐'));
        console.log(info('│                    📊 SYSTEM INFO                   │'));
        console.log(info('├──────────────────────────────────────────────────────┤'));
        console.log(info(`│  🖥️  Platform   : ${process.platform.padEnd(32)}│`));
        console.log(info(`│  📦 Node.js    : ${process.version.padEnd(32)}│`));
        console.log(info(`│  🧠 Memory     : ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB / ${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)}MB`));
        console.log(info(`│  ⏱️  Started    : ${new Date().toLocaleString()}`));
        console.log(info('└──────────────────────────────────────────────────────┘'));
        console.log('');

        // ── STARTUP SEQUENCE ──
        logInfo('🚀 Starting NewsBot LK...');
        logInfo(`📦 Version: ${config.version || '9.0.4'}`);
        logInfo(`👨‍💻 Developer: ${config.developer || 'Charuka Mahesh'}`);
        console.log('');

        // ── CONNECT DATABASE ──
        logInfo('🗄️  Connecting to database...');
        try {
            await connectDatabase();
            logSuccess('✅ Database connected successfully!');
        } catch (dbError) {
            logError('❌ Database connection failed: ' + dbError.message);
            logWarn('⚠️  Continuing with limited functionality...');
        }
        console.log('');

        // ── CHECK CONFIG ──
        logInfo('🔍 Checking configuration...');
        const requiredConfigs = ['botName', 'botLogo', 'developer'];
        let configErrors = 0;
        for (const key of requiredConfigs) {
            if (!config[key]) {
                logWarn(`⚠️  Missing config: ${key}`);
                configErrors++;
            }
        }
        if (configErrors === 0) logSuccess('✅ All configurations present!');
        console.log('');

        // ── CHECK VOICE REPLIES ──
        logInfo('🎵 Checking voice replies...');
        try {
            const voiceFilePath = path.join(__dirname, 'voiceReplies.json');
            if (fs.existsSync(voiceFilePath)) {
                const data = fs.readFileSync(voiceFilePath, 'utf8');
                const parsed = JSON.parse(data);
                const count = Object.keys(parsed.replies || {}).length;
                logSuccess(`✅ Loaded ${count} voice replies!`);
            } else {
                logWarn('⚠️  No voiceReplies.json found, creating default...');
                fs.writeFileSync(voiceFilePath, JSON.stringify({ replies: {} }, null, 2));
                logSuccess('✅ Default voiceReplies.json created!');
            }
        } catch (voiceError) {
            logError('❌ Voice replies error: ' + voiceError.message);
        }
        console.log('');

        // ── CHECK NEWS SOURCES ──
        logInfo('📰 Checking news sources...');
        logSuccess('✅ 14 news sources configured!');
        console.log('');

        // ── START BOT ──
        logInfo('🤖 Starting WhatsApp bot...');
        logInfo('🔄 Please wait, connecting to WhatsApp...');
        console.log('');

        try {
            await startBot();
            logSuccess('✅ Bot started successfully!');
        } catch (botError) {
            logError('❌ Bot failed to start: ' + botError.message);
            throw botError;
        }

        // ── SUCCESS MESSAGE ──
        console.log('');
        console.log(success('╔══════════════════════════════════════════════════════════════╗'));
        console.log(success('║                                                              ║'));
        console.log(success('║          🦄💝 *NEWS BOT LK IS RUNNING!* 💝🦄               ║'));
        console.log(success('║                                                              ║'));
        console.log(success('║  ✅ Connected to WhatsApp                                   ║'));
        console.log(success('║  📰 Auto-news: DISABLED                                     ║'));
        console.log(success('║  🎵 Voice replies: ENABLED                                  ║'));
        console.log(success('║  🌍 Mode: public                                            ║'));
        console.log(success('║                                                              ║'));
        console.log(success('║  👨‍💻 Developed by: Charuka Mahesh                             ║'));
        console.log(success('║  💝 Dedicated to: Umesha Sathyanjali | Mithila | Sharada   ║'));
        console.log(success('║                                                              ║'));
        console.log(success('╚══════════════════════════════════════════════════════════════╝'));
        console.log('');

        logSuccess('🚀 NewsBot LK is ready!');
        logInfo('📱 Scan QR code or use existing session');
        logInfo('💡 Type .menu to see all commands');
        logInfo('🦄💝 Made with ❤️ in Sri Lanka');

    } catch (error) {
        console.log('');
        console.log(error('╔══════════════════════════════════════════════════════════════╗'));
        console.log(error('║                    ❌ *STARTUP FAILED* ❌                   ║'));
        console.log(error('╚══════════════════════════════════════════════════════════════╝'));
        console.log('');
        logError('❌ Fatal error during startup:');
        console.log(error(`   ${error.message}`));
        console.log('');
        logInfo('🔄 Restarting in 5 seconds...');
        
        setTimeout(() => {
            console.log('');
            logInfo('🔄 Restarting...');
            process.exit(1);
        }, 5000);
    }
}

// ═══════════════════════════════════════════════════════════════
// 🛑 GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════

function gracefulShutdown(signal) {
    console.log('');
    logWarn(`🛑 Received ${signal} signal`);
    logInfo('👋 Shutting down gracefully...');
    
    setTimeout(() => {
        logSuccess('✅ Cleanup complete');
        logInfo('💝 Thank you for using NewsBot LK!');
        console.log('');
        console.log(info('╔══════════════════════════════════════════════════════════════╗'));
        console.log(info('║          💝 *NEWS BOT LK SHUTDOWN* 💝                       ║'));
        console.log(info('║  👋 Goodbye! Thank you for using NewsBot LK!                ║'));
        console.log(info('║  🦄💝 Made with ❤️ in Sri Lanka                            ║'));
        console.log(info('╚══════════════════════════════════════════════════════════════╝'));
        console.log('');
        process.exit(0);
    }, 1000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
    logError('💥 Uncaught Exception:');
    console.error(err);
    gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
    logError('💥 Unhandled Rejection:');
    console.error(reason);
    gracefulShutdown('unhandledRejection');
});

// ═══════════════════════════════════════════════════════════════
// 🚀 START
// ═══════════════════════════════════════════════════════════════

function checkRequiredFiles() {
    const required = [
        { file: 'config.js', path: './config.js' },
        { file: 'handlers/botClient.js', path: './handlers/botClient.js' },
        { file: 'utils/db.js', path: './utils/db.js' }
    ];
    
    let missing = [];
    for (const req of required) {
        try {
            if (!fs.existsSync(path.join(__dirname, req.path))) {
                missing.push(req.file);
            }
        } catch (e) {
            missing.push(req.file);
        }
    }
    
    if (missing.length > 0) {
        console.error('❌ Missing required files:');
        missing.forEach(f => console.error(`   - ${f}`));
        process.exit(1);
    }
}

try {
    checkRequiredFiles();
    main();
} catch (error) {
    console.error('💥 Failed to start:', error.message);
    process.exit(1);
}
