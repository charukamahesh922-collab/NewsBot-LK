// utils/constants.js

const path = require('path');

// =============================================
// 📁 PATHS
// =============================================

const STATUS_FOLDER = path.join(__dirname, '..', 'status_downloads');
const SAVE_FOLDER = path.join(__dirname, '..', 'saved_media');
const VV_FOLDER = path.join(__dirname, '..', 'view_once_saved');

// =============================================
// 🎲 STATUS EMOJIS
// =============================================

const STATUS_EMOJIS = ['💝', '❤️', '💕', '✨', '🌟', '🎉', '🥳', '🔥', '💪', '👏', '🙌', '🤗', '😍', '🥰', '😘', '💖', '💗', '💓', '💞', '💕'];

// =============================================
// 🎵 VOICE REPLY EMOJIS
// =============================================

const VOICE_EMOJIS = ['🎵', '🎶', '💬', '🗣️', '🔊', '📢', '🎙️', '🎤'];

// =============================================
// 📰 NEWS SOURCES
// =============================================

const NEWS_SOURCES = [
    'Hiru',
    'Derana',
    'AdaDerana RSS',
    'Sirasa',
    'Ada.lk',
    'Newswire',
    'Cricinfo',
    'BBC Sinhala',
    'Helakuru Esana',
    'ThePapare',
    'Sporty.lk',
    'BBC Cricket',
    'BBC Football',
    'Mawbima'
];

// =============================================
// 📦 EXPORTS
// =============================================

module.exports = {
    STATUS_FOLDER,
    SAVE_FOLDER,
    VV_FOLDER,
    STATUS_EMOJIS,
    VOICE_EMOJIS,
    NEWS_SOURCES
};
