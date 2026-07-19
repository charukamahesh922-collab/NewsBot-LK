// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  📱 Status Handler 📱                       ║
// ║         Auto View, React & View-Once Protection             ║
// ╚══════════════════════════════════════════════════════════════╝

// ============================================================
// 📊 STATUS TRACKING
// ============================================================

/** Timestamp of last status processed (for rate limiting) */
let lastStatusTime = 0;

/** Total statuses viewed (session) */
let totalStatusesViewed = 0;

/** Total reactions sent (session) */
let totalReactionsSent = 0;

/** View-Once statuses skipped (session) */
let viewOnceSkipped = 0;

// ============================================================
// 📱 STATUS HANDLER
// ============================================================

/**
 * 💝 Handle WhatsApp Status Updates
 * 
 * Features:
 * - Auto-view statuses from contacts
 * - Auto-react with random emoji
 * - Skip view-once statuses (privacy protection)
 * - Rate limiting (1 status per 3 seconds)
 * - Session statistics tracking
 * 
 * @param {Object} sock - WhatsApp socket connection
 * @param {Object} db - Database instance for settings
 * @param {Object} config - Bot configuration
 * @param {Object} msg - Status message object
 */
async function handleStatus(sock, db, config, msg) {
    // Validate socket connection
    if (!sock) {
        console.log('⚠️ Status handler: No socket connection');
        return;
    }

    try {
        const { key, message } = msg;

        // ═══════════════════════════════════════════════
        // 🔍 VALIDATION CHECKS
        // ═══════════════════════════════════════════════

        // Skip bot's own status
        if (key.fromMe) return;

        // Get status owner
        const participant = key.participant || key.remoteJid;
        
        // Skip if no participant or it's the bot itself
        if (!participant || participant === sock.user?.id) return;

        // ═══════════════════════════════════════════════
        // ⏱️ RATE LIMITING (1 status per 3 seconds)
        // ═══════════════════════════════════════════════
        const now = Date.now();
        if (now - lastStatusTime < 3000) return;
        lastStatusTime = now;

        // ═══════════════════════════════════════════════
        // 👤 EXTRACT SENDER INFO
        // ═══════════════════════════════════════════════
        const senderNumber = participant.split('@')[0].replace(/:.*/, '');
        const senderName = senderNumber.replace(/[^0-9]/g, '');

        // ═══════════════════════════════════════════════
        // ⚙️ LOAD SETTINGS
        // ═══════════════════════════════════════════════
        const autoView = await db.get('autoStatusView', true);
        const autoReact = await db.get('autoStatusReact', true);
        const antiViewOnce = await db.get('antiViewOnce', false);

        // ═══════════════════════════════════════════════
        // 🚫 VIEW-ONCE PROTECTION
        // ═══════════════════════════════════════════════
        if (antiViewOnce) {
            const isViewOnce = 
                msg.message?.imageMessage?.viewOnce ||
                msg.message?.videoMessage?.viewOnce;

            if (isViewOnce) {
                viewOnceSkipped++;
                console.log(`🚫 View-Once Skipped: ${senderNumber} (Total: ${viewOnceSkipped})`);
                return;
            }
        }

        // ═══════════════════════════════════════════════
        // 👁️ AUTO VIEW STATUS
        // ═══════════════════════════════════════════════
        if (!autoView) {
            console.log(`⏭️ Auto-view disabled, skipping: ${senderNumber}`);
            return;
        }

        // Mark status as viewed
        await sock.readMessages([key]);
        totalStatusesViewed++;
        console.log(`👁️ Status Viewed: ${senderNumber} (Total: ${totalStatusesViewed})`);

        // ═══════════════════════════════════════════════
        // 💬 AUTO REACT TO STATUS
        // ═══════════════════════════════════════════════
        if (autoReact && config.statusEmojis?.length > 0) {
            try {
                // Pick random emoji from configured list
                const emoji = config.statusEmojis[
                    Math.floor(Math.random() * config.statusEmojis.length)
                ];

                // Send reaction
                await sock.sendMessage('status@broadcast', {
                    react: {
                        text: emoji,
                        key: key
                    }
                });

                totalReactionsSent++;
                console.log(`  💬 Reacted: ${emoji} (Total: ${totalReactionsSent})`);

            } catch (reactError) {
                // Silent fail for reactions (not critical)
                console.log(`  ⚠️ Reaction failed: ${reactError.message}`);
            }
        }

    } catch (error) {
        console.error('❌ Status Handler Error:', error.message);
    }
}

// ============================================================
// 📊 STATUS STATISTICS
// ============================================================

/**
 * Get status handler statistics
 * @returns {Object} - Statistics object
 */
function getStatusStats() {
    return {
        totalViewed: totalStatusesViewed,
        totalReactions: totalReactionsSent,
        viewOnceSkipped: viewOnceSkipped,
        lastProcessed: lastStatusTime ? new Date(lastStatusTime).toISOString() : null,
        rateLimitMs: 3000
    };
}

/**
 * Reset status statistics
 */
function resetStatusStats() {
    totalStatusesViewed = 0;
    totalReactionsSent = 0;
    viewOnceSkipped = 0;
    console.log('🔄 Status statistics reset');
}

// ============================================================
// ⚙️ STATUS CONFIGURATION
// ============================================================

/**
 * Default status emojis (used if config doesn't specify)
 */
const DEFAULT_STATUS_EMOJIS = [
    '🖤',   // Black Heart
    '❤️',   // Red Heart
    '🔥',   // Fire
    '👍',   // Thumbs Up
    '💯',   // 100
    '👏',   // Clap
    '😍',   // Heart Eyes
    '✨',   // Sparkles
    '🌟',   // Glowing Star
    '💫'    // Dizzy/Star
];

/**
 * Status handler configuration
 */
const STATUS_CONFIG = {
    // Minimum interval between status processing (ms)
    rateLimitMs: 3000,
    
    // Whether to log verbose output
    verbose: true,
    
    // Default emojis for reactions
    defaultEmojis: DEFAULT_STATUS_EMOJIS
};

// ============================================================
// 📤 EXPORTS
// ============================================================
module.exports = {
    handleStatus,
    getStatusStats,
    resetStatusStats,
    STATUS_CONFIG,
    DEFAULT_STATUS_EMOJIS
};
