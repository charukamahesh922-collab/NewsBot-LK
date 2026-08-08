// commands/general.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMainMenu } = require('../menus/mainMenu');
const { sendSettingsMenu } = require('../menus/settingsMenu');
const { STATUS_FOLDER, SAVE_FOLDER, VV_FOLDER } = require('../utils/constants');
const fetchAllLatestNews = require('../news/fetchAll');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, smartTruncate } = require('../news/utils');

const react = async (sock, jid, key, emoji) => {
    try { await sock.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
};

const footer = () => '🦄💝 *NewsBot LK* | Charuka Mahesh';

const box = (title, lines) => [
    '╭' + '─'.repeat(38) + '╮', '┃  ' + title, '╰' + '─'.repeat(38) + '╯', '', ...lines, '', footer()
].join('\n');

const divider = (title) => `┄`.repeat(10) + ` ${title} ` + `┄`.repeat(10);
const toggle = (v) => v ? '✅ *ON*' : '❌ *OFF*';
const randEmoji = (arr) => arr[Math.floor(Math.random() * arr.length)];
const REACTIONS = ['📰', '🔥', '👍', '💯', '👏'];

async function sendNewsToJid(sock, jid, article, sendReaction = true) {
    if (!sock?.user) return false;
    let desc = article.description || article.title || '📰 Click to read';
    desc = cleanNewsText(desc);
    if (isGarbageDescription(desc)) desc = article.title;
    desc = fixLineBreaks(desc);
    desc = smartTruncate(desc, 2500);
    desc = desc.replace(/\. /g, '.\n\n').replace(/\? /g, '?\n\n').replace(/! /g, '!\n\n').replace(/। /g, '।\n\n');
    desc = desc.split('\n').filter(p => p.trim().length > 0).join('\n\n');
    const articleDate = article.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const cap = ['╭' + '─'.repeat(40) + '╮', '┃  📰 *' + article.source + '*', '┃  📂 ' + article.category, '╰' + '─'.repeat(40) + '╯', '', '📌 *' + article.title + '*', '', '─'.repeat(40), '', desc, '', '─'.repeat(40), '', '📅 *' + articleDate + '*', '🔗 ' + article.url, '', footer()].filter(l => l !== null).join('\n');
    try {
        let sent = null;
        const imgUrl = article.image || null;
        if (imgUrl && imgUrl.length > 10 && !imgUrl.includes('undefined')) {
            try {
                const ir = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (ir.data?.length > 1000) {
                    try { const sharp = require('sharp'); const converted = await sharp(Buffer.from(ir.data)).jpeg().toBuffer(); sent = await sock.sendMessage(jid, { image: converted, caption: cap, mimetype: 'image/jpeg' }); } catch { sent = await sock.sendMessage(jid, { image: Buffer.from(ir.data), caption: cap, mimetype: 'image/jpeg' }); }
                }
            } catch (e) {}
        }
        if (!sent && article.botLogo) {
            try { const lr = await axios.get(article.botLogo, { responseType: 'arraybuffer', timeout: 10000 }); if (lr.data?.length > 1000) sent = await sock.sendMessage(jid, { image: Buffer.from(lr.data), caption: cap, mimetype: 'image/png' }); } catch (e) {}
        }
        if (!sent) sent = await sock.sendMessage(jid, { text: cap });
        if (sent && sendReaction) await sock.sendMessage(jid, { react: { text: randEmoji(REACTIONS), key: sent.key } });
        return true;
    } catch (e) { try { await sock.sendMessage(jid, { text: cap }); return true; } catch { return false; } }
}

async function sendNewsCommand(sock, jid, db, isGroup) {
    if (!sock?.user) return;
    const statusMsg = await sock.sendMessage(jid, { text: box('📰 *FETCHING NEWS*', ['  ⏳ Getting latest headlines...', '  📡 Connecting to 15 sources']) });
    await react(sock, jid, statusMsg.key, '⏳');
    try {
        const all = await fetchAllLatestNews();
        if (!all.length) { const sent = await sock.sendMessage(jid, { text: box('📭 *NO NEWS*', ['  📭 No articles available right now', '  💡 Try again in a few minutes']) }); await react(sock, jid, sent.key, '📭'); return; }
        const urls = await db.urlsGet();
        const max = isGroup ? 5 : 8;
        const newArticles = all.filter(a => a.url && !urls.includes(a.url));
        if (!newArticles.length) { const sent = await sock.sendMessage(jid, { text: box('📭 *NO NEW NEWS*', [`  📊 Total tracked: *${all.length}*`, `  ⏱️ Auto updates every *${(config?.checkIntervalMs || 120000) / 1000}s*`, '  💡 All articles already sent!']) }); await react(sock, jid, sent.key, '📭'); return; }
        let sentCount = 0;
        for (const a of newArticles.slice(0, max)) { if (await sendNewsToJid(sock, jid, a, true)) { await db.urlsAdd(a.url); sentCount++; } await new Promise(r => setTimeout(r, 2000)); }
        const sent = await sock.sendMessage(jid, { text: box('✅ *NEWS SENT*', [`  ✅ Sent: *${sentCount} articles*`, `  🆕 New available: *${newArticles.length}*`, `  📊 Total tracked: *${all.length}*`]) });
        await react(sock, jid, sent.key, '✅');
    } catch (e) { console.error('❌ News error:', e.message); await sock.sendMessage(jid, { text: box('❌ *NEWS ERROR*', ['  ❌ Failed to fetch news', '  💡 Check your internet connection']) }); }
}

// ═══════════════════════════════════════════════════════
// 📰 AUTO NEWS CHECK - WITH DEBUG LOGS
// ═══════════════════════════════════════════════════════
async function checkAndShareAllNewNews(sock, db, config) {
    console.log('📰 [NEWS] Starting fetch...');
    console.log('📰 [NEWS] sock.user:', !!sock?.user);
    console.log('📰 [NEWS] newsGroupJid:', config?.newsGroupJid || 'MISSING!');
    
    if (!sock?.user) { console.log('📰 [NEWS] ❌ No sock.user - aborting'); return; }
    const newsGroupJid = config?.newsGroupJid;
    if (!newsGroupJid) { console.log('📰 [NEWS] ❌ No newsGroupJid in config!'); return; }
    if (await db.groupGet(newsGroupJid, 'isMuted', false)) { console.log('📰 [NEWS] ❌ Group is muted'); return; }

    try {
        console.log('📰 [NEWS] Fetching from sources...');
        const all = await fetchAllLatestNews();
        console.log(`📰 [NEWS] Fetched ${all.length} articles`);
        
        if (!all.length) { console.log('📰 [NEWS] ❌ No articles'); return; }

        const urls = await db.urlsGet();
        console.log(`📰 [NEWS] Tracked URLs: ${urls.length}`);
        
        // FIRST RUN: Send initial news instead of just marking
        if (!urls.length) {
            console.log('📰 [NEWS] First run - sending initial 5 articles...');
            let sent = 0;
            for (const article of all.slice(0, 5)) {
                if (article.url) {
                    console.log(`📰 [NEWS] Sending: ${article.title?.substring(0, 50)}`);
                    if (await sendNewsToJid(sock, newsGroupJid, { ...article, botLogo: config.botLogo }, true)) {
                        await db.urlsAdd(article.url);
                        sent++;
                    }
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
            // Mark remaining as sent
            for (const article of all.slice(5)) {
                if (article.url) await db.urlsAdd(article.url);
            }
            console.log(`📰 [NEWS] ✅ First run done! Sent ${sent}, marked ${all.length} total`);
            return;
        }

        // NORMAL RUN: Send new articles
        console.log(`📰 [NEWS] Sending to group: ${newsGroupJid}`);
        let s = 0;
        for (const i of all) {
            if (!i.url || urls.includes(i.url)) continue;
            console.log(`📰 [NEWS] Sending: ${i.title?.substring(0, 50)}`);
            if (await sendNewsToJid(sock, newsGroupJid, { ...i, botLogo: config.botLogo }, true)) {
                await db.urlsAdd(i.url);
                s++;
            }
            await new Promise(r => setTimeout(r, 3000));
        }
        if (s > 0) console.log(`📰 [NEWS] ✅ Done! Sent ${s} new articles`);
        else console.log('📰 [NEWS] No new articles to send');
    } catch (e) {
        console.log('📰 [NEWS] ❌ Error:', e.message || e);
    }
}

// ═══════════════════════════════════════════════════════
// ALL OTHER FUNCTIONS (unchanged)
// ═══════════════════════════════════════════════════════

async function handleMenuCommand(sock, jid, db, config, isOwner, isAdmin, isGroup) { const prefix = await db.get('prefix', '.'); await sendMainMenu(sock, jid, db, config, isOwner, isAdmin, isGroup, prefix); }

async function handleStatsCommand(sock, jid, db, config) { /* ... keep existing ... */ }

async function handleAboutCommand(sock, jid, config) { /* ... keep existing ... */ }

async function handleHelpCommand(sock, jid, db, isOwner, isAdmin, isGroup) { /* ... keep existing ... */ }

async function handlePingCommand(sock, jid) { /* ... keep existing ... */ }

async function handleTimeCommand(sock, jid) { /* ... keep existing ... */ }

async function handleWeatherCommand(sock, jid, text) { /* ... keep existing ... */ }

async function handleTextTools(sock, jid, text, command) { /* ... keep existing ... */ }

async function handleEditCommand(sock, msg, jid, text) { /* ... keep existing ... */ }
async function handleReactCommand(sock, msg, jid, text) { /* ... keep existing ... */ }
async function handleDocumentCommand(sock, msg, jid) { /* ... keep existing ... */ }
async function handleSearchCommand(sock, jid, text) { /* ... keep existing ... */ }
async function handleMyPpCommand(sock, jid) { /* ... keep existing ... */ }
async function handleMyAboutCommand(sock, jid) { /* ... keep existing ... */ }
async function handleLocationCommand(sock, jid, text) { /* ... keep existing ... */ }
async function handleSendContactCommand(sock, jid, text, sender) { /* ... keep existing ... */ }
async function handlePinCommand(sock, jid, msg, duration) { /* ... keep existing ... */ }
async function handleUnpinCommand(sock, jid, msg) { /* ... keep existing ... */ }
async function handleChatDisappearCommand(sock, jid, arg) { /* ... keep existing ... */ }
async function handleForwardCommand(sock, jid, msg) { /* ... keep existing ... */ }

module.exports = {
    sendNewsToJid,
    sendNewsCommand,
    checkAndShareAllNewNews,
    handleMenuCommand,
    handleStatsCommand,
    handleAboutCommand,
    handleHelpCommand,
    handlePingCommand,
    handleTimeCommand,
    handleWeatherCommand,
    handleTextTools,
    handleLocationCommand,
    handleSendContactCommand,
    handlePinCommand,
    handleUnpinCommand,
    handleChatDisappearCommand,
    handleForwardCommand,
    handleEditCommand,
    handleReactCommand,
    handleDocumentCommand,
    handleSearchCommand,
    handleMyPpCommand,
    handleMyAboutCommand,
};
