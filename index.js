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
║           📦 Version: ${(config.version || '9.0.4').padEnd(20)}║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

// ═══════════════════════════════════════════════════════════════
// 🎨 COLOR HELPERS
// ═══════════════════════════════════════════════════════════════

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',
    
    fg: {
        black: '\x1b[30m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        crimson: '\x1b[38m'
    },
    
    bg: {
        black: '\x1b[40m',
        red: '\x1b[41m',
        green: '\x1b[42m',
        yellow: '\x1b[43m',
        blue: '\x1b[44m',
        magenta: '\x1b[45m',
        cyan: '\x1b[46m',
        white: '\x1b[47m',
        crimson: '\x1b[48m'
    }
};

const colorize = (text, color = colors.fg.cyan) => `${color}${text}${colors.reset}`;
const bright = (text) => colorize(text, colors.bright);
const success = (text) => colorize(text, colors.fg.green);
const error = (text) => colorize(text, colors.fg.red);
const warn = (text) => colorize(text, colors.fg.yellow);
const info = (text) => colorize(text, colors.fg.cyan);
const highlight = (text) => colorize(text, colors.fg.magenta);

// ═══════════════════════════════════════════════════════════════
// 📝 LOGGING HELPERS
// ═══════════════════════════════════════════════════════════════

function logWithTimestamp(message, type = 'INFO') {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const colors = {
        'INFO': '\x1b[36m',
        'SUCCESS': '\x1b[32m',
        'WARN': '\x1b[33m',
        'ERROR': '\x1b[31m',
        'DEBUG': '\x1b[35m'
    };
    const color = colors[type] || colors.INFO;
    console.log(`${color}[${timestamp}] ${type.padEnd(7)}${'\x1b[0m'} ${message}`);
}

function logInfo(message) { logWithTimestamp(message, 'INFO'); }
function logSuccess(message) { logWithTimestamp(message, 'SUCCESS'); }
function logWarn(message) { logWithTimestamp(message, 'WARN'); }
function logError(message) { logWithTimestamp(message, 'ERROR'); }
function logDebug(message) { logWithTimestamp(message, 'DEBUG'); }

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
        console.log(info(`│  🧠 Memory     : ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB / ${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)}MB${' '.repeat(32 - (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2).length - (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2).length - 1)}│`));
        console.log(info(`│  ⏱️  Started    : ${new Date().toLocaleString().padEnd(32)}│`));
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
        if (configErrors === 0) {
            logSuccess('✅ All configurations present!');
        }
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
        const defaultSources = [
            'BBC Sinhala',
            'Hiru News',
            'Derana News',
            'Ada Derana',
            'Sirasa News',
            'Ada.lk',
            'Newswire',
            'Cricinfo',
            'Helakuru Esana',
            'ThePapare',
            'Sporty.lk',
            'BBC Cricket',
            'BBC Football',
            'Mawbima'
        ];
        logSuccess(`✅ ${defaultSources.length} news sources configured!`);
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
        console.log(success(`║  ✅ Connected to WhatsApp                                   ║`));
        console.log(success(`║  📰 Auto-news: ${config.autoNewsEnabled ? 'ENABLED' : 'DISABLED'}                                        ║`));
        console.log(success(`║  🎵 Voice replies: ${config.voiceReplyEnabled !== false ? 'ENABLED' : 'DISABLED'}                                  ║`));
        console.log(success(`║  🌍 Mode: ${config.botMode || 'public'}                                            ║`));
        console.log(success('║                                                              ║'));
        console.log(success(`║  👨‍💻 Developed by: ${config.developer || 'Charuka Mahesh'}`.padEnd(70) + '║'));
        console.log(success('║  💝 Dedicated to: Umesha Sathyanjali | Mithila | Sharada   ║'));
        console.log(success('║                                                              ║'));
        console.log(success('╚══════════════════════════════════════════════════════════════╝'));
        console.log('');

        // ── STARTUP COMPLETE ──
        logSuccess('🚀 NewsBot LK is ready!');
        logInfo('📱 Scan QR code or use existing session');
        logInfo('💡 Type .menu to see all commands');
        logInfo('🦄💝 Made with ❤️ in Sri Lanka');

    } catch (error) {
        // ── ERROR HANDLING ──
        console.log('');
        console.log(error('╔══════════════════════════════════════════════════════════════╗'));
        console.log(error('║                    ❌ *STARTUP FAILED* ❌                   ║'));
        console.log(error('╚══════════════════════════════════════════════════════════════╝'));
        console.log('');
        logError('❌ Fatal error during startup:');
        console.log(error(`   ${error.message}`));
        if (error.stack) {
            console.log(error(`   Stack: ${error.stack.split('\n').slice(1, 3).join('\n   ')}`));
        }
        console.log('');
        logInfo('🔄 Restarting in 5 seconds...');
        
        // ── AUTO-RESTART ──
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
    
    // Give time for cleanup
    setTimeout(() => {
        logSuccess('✅ Cleanup complete');
        logInfo('💝 Thank you for using NewsBot LK!');
        console.log('');
        console.log(info('╔══════════════════════════════════════════════════════════════╗'));
        console.log(info('║                                                              ║'));
        console.log(info('║          💝 *NEWS BOT LK SHUTDOWN* 💝                       ║'));
        console.log(info('║                                                              ║'));
        console.log(info('║  👋 Goodbye! Thank you for using NewsBot LK!                ║'));
        console.log(info('║  🦄💝 Made with ❤️ in Sri Lanka                            ║'));
        console.log(info('║                                                              ║'));
        console.log(info('╚══════════════════════════════════════════════════════════════╝'));
        console.log('');
        process.exit(0);
    }, 1000);
}

// ── REGISTER SIGNAL HANDLERS ──
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
    logError('💥 Uncaught Exception:');
    console.error(error);
    gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
    logError('💥 Unhandled Rejection:');
    console.error(reason);
    gracefulShutdown('unhandledRejection');
});

// ═══════════════════════════════════════════════════════════════
// 🚀 START APPLICATION
// ═══════════════════════════════════════════════════════════════

// Check for required files
function checkRequiredFiles() {
    const required = [
        { file: 'config.js', path: './config.js' },
        { file: 'handlers/botClient.js', path: './handlers/botClient.js' },
        { file: 'utils/db.js', path: './utils/db.js' }
    ];
    
    let missing = [];
    for (const req of required) {
        try {
            const fullPath = path.join(__dirname, req.path);
            if (!fs.existsSync(fullPath)) {
                missing.push(req.file);
            }
        } catch (e) {
            missing.push(req.file);
        }
    }
    
    if (missing.length > 0) {
        logError('❌ Missing required files:');
        missing.forEach(f => console.log(`   - ${f}`));
        console.log('');
        logError('❌ Please ensure all required files exist!');
        process.exit(1);
    }
}

// ── RUN CHECKS ──
try {
    checkRequiredFiles();
    main();
} catch (error) {
    logError('💥 Failed to start: ' + error.message);
    console.error(error);
    process.exit(1);
}
