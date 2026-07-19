// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🗄️ Database Module 🗄️                      ║
// ║         MongoDB + JSON Fallback Support                      ║
// ╚══════════════════════════════════════════════════════════════╝

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// ============================================================
// 📁 JSON DATABASE (Fallback)
// ============================================================
const JSON_DB_FILE = path.join(__dirname, '..', 'database.json');
let useJsonFallback = false;

let jsonDb = {
    settings: {},
    warnings: {},
    bans: [],
    afk: {},
    groupSettings: {},
    sentUrls: []
};

/**
 * Load JSON database from file
 */
function loadJsonDb() {
    try {
        if (fs.existsSync(JSON_DB_FILE)) {
            const data = JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8'));
            jsonDb = {
                settings: {},
                warnings: {},
                bans: [],
                afk: {},
                groupSettings: {},
                sentUrls: [],
                ...data
            };
            console.log('📁 JSON database loaded');
        }
    } catch (error) {
        console.error('❌ Failed to load JSON database:', error.message);
    }
}

/**
 * Save JSON database to file
 */
function saveJsonDb() {
    try {
        fs.writeFileSync(JSON_DB_FILE, JSON.stringify(jsonDb, null, 2));
    } catch (error) {
        console.error('❌ Failed to save JSON database:', error.message);
    }
}

// ============================================================
// 🍃 MONGOOSE SCHEMAS
// ============================================================

/**
 * Settings Schema
 * Stores bot configuration key-value pairs
 */
const settingSchema = new mongoose.Schema({
    key: {
        type: String,
        unique: true,
        required: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

/**
 * Warning Schema
 * Tracks user warnings per group
 */
const warningSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    groupId: {
        type: String,
        required: true
    },
    count: {
        type: Number,
        default: 1
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}).index({ userId: 1, groupId: 1 });

/**
 * Ban Schema
 * Stores banned users
 */
const banSchema = new mongoose.Schema({
    userId: {
        type: String,
        unique: true,
        required: true
    },
    reason: {
        type: String,
        default: ''
    },
    bannedAt: {
        type: Date,
        default: Date.now
    }
});

/**
 * AFK Schema
 * Tracks users who are away
 */
const afkSchema = new mongoose.Schema({
    userId: {
        type: String,
        unique: true,
        required: true
    },
    reason: {
        type: String,
        default: 'AFK'
    },
    afkAt: {
        type: Date,
        default: Date.now
    }
});

/**
 * Group Settings Schema
 * Per-group configuration
 */
const groupSettingSchema = new mongoose.Schema({
    groupId: {
        type: String,
        unique: true,
        required: true
    },
    isMuted: {
        type: Boolean,
        default: false
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { strict: false });

// ============================================================
// 🍃 MONGOOSE MODELS
// ============================================================
let Setting, Warning, Ban, Afk, GroupSetting;

// ============================================================
// 🔌 DATABASE CONNECTION
// ============================================================

/**
 * Connect to database (MongoDB or JSON fallback)
 * @param {Object} config - Bot configuration
 * @returns {boolean} - True if MongoDB connected, false if JSON fallback
 */
async function connectDatabase(config) {
    // Check if MongoDB is disabled via environment variable
    if (process.env.MONGO_ENABLED === 'false') {
        useJsonFallback = true;
        loadJsonDb();
        console.log('🗄️ Using JSON Database (fallback)');
        return false;
    }

    // Try MongoDB URLs
    const urls = [
        { name: 'Internal', url: config.mongoInternal },
        { name: 'Public', url: config.mongoPublic }
    ];

    for (const { name, url } of urls) {
        try {
            console.log(`🔌 Connecting to MongoDB (${name})...`);

            await mongoose.connect(url, {
                dbName: config.dbName,
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                ssl: false,
                tls: false,
                retryWrites: false
            });

            // Initialize models
            Setting = mongoose.model('Setting', settingSchema);
            Warning = mongoose.model('Warning', warningSchema);
            Ban = mongoose.model('Ban', banSchema);
            Afk = mongoose.model('Afk', afkSchema);
            GroupSetting = mongoose.model('GroupSetting', groupSettingSchema);

            // Initialize default settings if collection is empty
            const count = await Setting.countDocuments();
            if (count === 0) {
                console.log('📝 Initializing default settings...');
                for (const [key, value] of Object.entries(config.defaults)) {
                    await Setting.create({ key, value });
                }
                console.log(`✅ ${Object.keys(config.defaults).length} default settings created`);
            }

            console.log(`✅ MongoDB Connected (${name})`);
            return true;

        } catch (error) {
            console.error(`❌ MongoDB ${name} connection failed:`, error.message);
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }
        }
    }

    // Fallback to JSON if all MongoDB URLs fail
    console.log('⚠️ All MongoDB connections failed, using JSON fallback');
    useJsonFallback = true;
    loadJsonDb();
    return false;
}

// ============================================================
// 🗃️ DATABASE OPERATIONS
// ============================================================

const db = {
    /**
     * Check if using JSON fallback
     */
    isJson: () => useJsonFallback,

    // ═══════════════════════════════════════════════════════
    // ⚙️ SETTINGS
    // ═══════════════════════════════════════════════════════

    /**
     * Get a setting value
     * @param {string} key - Setting key
     * @param {*} defaultValue - Default value if not found
     */
    get: async (key, defaultValue) => {
        if (useJsonFallback) {
            return jsonDb.settings[key] ?? defaultValue;
        }
        try {
            const doc = await Setting.findOne({ key });
            return doc ? doc.value : defaultValue;
        } catch (error) {
            console.error(`❌ DB Get Error (${key}):`, error.message);
            return defaultValue;
        }
    },

    /**
     * Set a setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    set: async (key, value) => {
        if (useJsonFallback) {
            jsonDb.settings[key] = value;
            saveJsonDb();
            return true;
        }
        try {
            await Setting.updateOne(
                { key },
                { $set: { key, value, updatedAt: new Date() } },
                { upsert: true }
            );
            return true;
        } catch (error) {
            console.error(`❌ DB Set Error (${key}):`, error.message);
            return false;
        }
    },

    /**
     * Get all settings
     */
    all: async () => {
        if (useJsonFallback) {
            return { ...jsonDb.settings };
        }
        try {
            const docs = await Setting.find({});
            const settings = {};
            docs.forEach(doc => {
                settings[doc.key] = doc.value;
            });
            return settings;
        } catch (error) {
            console.error('❌ DB All Error:', error.message);
            return {};
        }
    },

    // ═══════════════════════════════════════════════════════
    // ⚠️ WARNINGS
    // ═══════════════════════════════════════════════════════

    /**
     * Add a warning to a user
     * @param {string} userId - User ID
     * @param {string} groupId - Group ID
     * @returns {number} - Current warning count
     */
    warnAdd: async (userId, groupId) => {
        if (useJsonFallback) {
            const key = `${userId}_${groupId}`;
            jsonDb.warnings[key] = (jsonDb.warnings[key] || 0) + 1;
            saveJsonDb();
            return jsonDb.warnings[key];
        }
        try {
            const result = await Warning.findOneAndUpdate(
                { userId, groupId },
                { $inc: { count: 1 } },
                { upsert: true, new: true }
            );
            return result?.count || 0;
        } catch (error) {
            console.error('❌ Warn Add Error:', error.message);
            return 0;
        }
    },

    /**
     * Clear warnings for a user
     * @param {string} userId - User ID
     * @param {string} groupId - Group ID
     */
    warnClear: async (userId, groupId) => {
        if (useJsonFallback) {
            delete jsonDb.warnings[`${userId}_${groupId}`];
            saveJsonDb();
            return true;
        }
        try {
            await Warning.deleteMany({ userId, groupId });
            return true;
        } catch (error) {
            console.error('❌ Warn Clear Error:', error.message);
            return false;
        }
    },

    // ═══════════════════════════════════════════════════════
    // 🚫 BANS
    // ═══════════════════════════════════════════════════════

    /**
     * Ban a user
     * @param {string} userId - User ID to ban
     * @param {string} reason - Ban reason
     */
    banAdd: async (userId, reason = '') => {
        if (useJsonFallback) {
            if (!jsonDb.bans.find(b => b.userId === userId)) {
                jsonDb.bans.push({
                    userId,
                    reason,
                    bannedAt: new Date().toISOString()
                });
                saveJsonDb();
            }
            return true;
        }
        try {
            await Ban.updateOne(
                { userId },
                { $set: { userId, reason, bannedAt: new Date() } },
                { upsert: true }
            );
            return true;
        } catch (error) {
            console.error('❌ Ban Add Error:', error.message);
            return false;
        }
    },

    /**
     * Unban a user
     * @param {string} userId - User ID to unban
     */
    banRemove: async (userId) => {
        if (useJsonFallback) {
            jsonDb.bans = jsonDb.bans.filter(b => b.userId !== userId);
            saveJsonDb();
            return true;
        }
        try {
            await Ban.deleteOne({ userId });
            return true;
        } catch (error) {
            console.error('❌ Ban Remove Error:', error.message);
            return false;
        }
    },

    /**
     * Check if a user is banned
     * @param {string} userId - User ID to check
     */
    banCheck: async (userId) => {
        if (useJsonFallback) {
            return jsonDb.bans.some(b => b.userId === userId);
        }
        try {
            return !!(await Ban.findOne({ userId }));
        } catch (error) {
            console.error('❌ Ban Check Error:', error.message);
            return false;
        }
    },

    /**
     * Get all banned users
     */
    banAll: async () => {
        if (useJsonFallback) {
            return jsonDb.bans;
        }
        try {
            return await Ban.find({});
        } catch (error) {
            console.error('❌ Ban All Error:', error.message);
            return [];
        }
    },

    // ═══════════════════════════════════════════════════════
    // 💤 AFK SYSTEM
    // ═══════════════════════════════════════════════════════

    /**
     * Set AFK status for a user
     * @param {string} userId - User ID
     * @param {string} reason - AFK reason
     */
    afkSet: async (userId, reason) => {
        if (useJsonFallback) {
            jsonDb.afk[userId] = {
                userId,
                reason,
                afkAt: new Date().toISOString()
            };
            saveJsonDb();
            return true;
        }
        try {
            await Afk.updateOne(
                { userId },
                { $set: { userId, reason, afkAt: new Date() } },
                { upsert: true }
            );
            return true;
        } catch (error) {
            console.error('❌ AFK Set Error:', error.message);
            return false;
        }
    },

    /**
     * Remove AFK status for a user
     * @param {string} userId - User ID
     */
    afkRemove: async (userId) => {
        if (useJsonFallback) {
            delete jsonDb.afk[userId];
            saveJsonDb();
            return true;
        }
        try {
            await Afk.deleteOne({ userId });
            return true;
        } catch (error) {
            console.error('❌ AFK Remove Error:', error.message);
            return false;
        }
    },

    /**
     * Get AFK status for a user
     * @param {string} userId - User ID
     */
    afkGet: async (userId) => {
        if (useJsonFallback) {
            return jsonDb.afk[userId] || null;
        }
        try {
            return await Afk.findOne({ userId });
        } catch (error) {
            console.error('❌ AFK Get Error:', error.message);
            return null;
        }
    },

    // ═══════════════════════════════════════════════════════
    // 👥 GROUP SETTINGS
    // ═══════════════════════════════════════════════════════

    /**
     * Get a group setting
     * @param {string} groupId - Group ID
     * @param {string} key - Setting key
     * @param {*} defaultValue - Default value
     */
    groupGet: async (groupId, key, defaultValue) => {
        if (useJsonFallback) {
            return jsonDb.groupSettings[groupId]?.[key] ?? defaultValue;
        }
        try {
            const doc = await GroupSetting.findOne({ groupId });
            return doc?.[key] ?? defaultValue;
        } catch (error) {
            console.error('❌ Group Get Error:', error.message);
            return defaultValue;
        }
    },

    /**
     * Set a group setting
     * @param {string} groupId - Group ID
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    groupSet: async (groupId, key, value) => {
        if (useJsonFallback) {
            if (!jsonDb.groupSettings[groupId]) {
                jsonDb.groupSettings[groupId] = {};
            }
            jsonDb.groupSettings[groupId][key] = value;
            saveJsonDb();
            return true;
        }
        try {
            await GroupSetting.updateOne(
                { groupId },
                { $set: { [key]: value } },
                { upsert: true }
            );
            return true;
        } catch (error) {
            console.error('❌ Group Set Error:', error.message);
            return false;
        }
    },

    // ═══════════════════════════════════════════════════════
    // 📰 URL TRACKING
    // ═══════════════════════════════════════════════════════

    /**
     * Get all sent news URLs
     */
    urlsGet: async () => {
        if (useJsonFallback) {
            return jsonDb.sentUrls || [];
        }
        try {
            const doc = await Setting.findOne({ key: 'sentUrls' });
            return doc?.value || [];
        } catch (error) {
            console.error('❌ URLs Get Error:', error.message);
            return [];
        }
    },

    /**
     * Add a sent news URL
     * @param {string} url - News URL
     */
    urlsAdd: async (url) => {
        if (useJsonFallback) {
            if (!jsonDb.sentUrls.includes(url)) {
                jsonDb.sentUrls.push(url);
                saveJsonDb();
            }
            return true;
        }
        try {
            await Setting.updateOne(
                { key: 'sentUrls' },
                { $addToSet: { value: url } },
                { upsert: true }
            );
            return true;
        } catch (error) {
            console.error('❌ URLs Add Error:', error.message);
            return false;
        }
    },

    /**
     * Count all sent news URLs
     */
    urlsCount: async () => {
        if (useJsonFallback) {
            return jsonDb.sentUrls.length;
        }
        try {
            const doc = await Setting.findOne({ key: 'sentUrls' });
            return doc?.value?.length || 0;
        } catch (error) {
            console.error('❌ URLs Count Error:', error.message);
            return 0;
        }
    },
};

// ============================================================
// 📤 EXPORTS
// ============================================================
module.exports = { db, connectDatabase };
