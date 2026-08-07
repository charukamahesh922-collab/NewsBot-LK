const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMainMenu } = require('../menus/mainMenu');
const { sendSettingsMenu } = require('../menus/settingsMenu');
const { STATUS_FOLDER, SAVE_FOLDER, VV_FOLDER } = require('../utils/constants');
const fetchAllLatestNews = require('../news/fetchAll');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, smartTruncate } = require('../news/utils');

// ═══════════════════════════════════════════════════════
// 🎨 HELPERS
// ═══════════════════════════════════════════════════════

const react = async (sock, jid, key, emoji) => {
    try { await sock.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
};

const footer = () => '🦄💝 *NewsBot LK* | Charuka Mahesh';

const box = (title, lines) => [
    '╭' + '─'.repeat(38) + '╮',
    '┃  ' + title,
    '╰' + '─'.repeat(38) + '╯',
    '',
    ...lines,
    '',
    footer()
].join('\n');

const divider = (title) => `┄`.repeat(10) + ` ${title} ` + `┄`.repeat(10);
const toggle = (v) => v ? '✅ *ON*' : '❌ *OFF*';
const randEmoji = (arr) => arr[Math.floor(Math.random() * arr.length)];

const REACTIONS = ['📰', '🔥', '👍', '💯', '👏'];

// ═══════════════════════════════════════════════════════
// 📰 SEND NEWS TO JID
// ═══════════════════════════════════════════════════════

async function sendNewsToJid(sock, jid, article, sendReaction = true) {
    if (!sock?.user) return false;

    let desc = article.description || article.title || '📰 Click to read';
    desc = cleanNewsText(desc);
    if (isGarbageDescription(desc)) desc = article.title;
    desc = fixLineBreaks(desc);
    desc = smartTruncate(desc, 2500);
    desc = desc
        .replace(/\. /g, '.\n\n')
        .replace(/\? /g, '?\n\n')
        .replace(/! /g, '!\n\n')
        .replace(/। /g, '।\n\n');
    desc = desc.split('\n').filter(p => p.trim().length > 0).join('\n\n');

    const articleDate = article.date || new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const cap = [
        '╭' + '─'.repeat(40) + '╮',
        '┃  📰 *' + article.source + '*',
        '┃  📂 ' + article.category,
        '╰' + '─'.repeat(40) + '╯',
        '',
        '📌 *' + article.title + '*',
        '',
        '─'.repeat(40),
        '',
        desc,
        '',
        '─'.repeat(40),
        '',
        '📅 *' + articleDate + '*',
        '🔗 ' + article.url,
        '',
        footer()
    ].filter(l => l !== null).join('\n');

    try {
        let sent = null;
        const imgUrl = article.image || null;

        // Try article image
        if (imgUrl && imgUrl.length > 10 && !imgUrl.includes('undefined')) {
            try {
                const ir = await axios.get(imgUrl, {
                    responseType: 'arraybuffer',
                    timeout: 15000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (ir.data?.length > 1000) {
                    // Convert to JPEG to avoid unsupported format error
                    try {
                        const sharp = require('sharp');
                        const converted = await sharp(Buffer.from(ir.data)).jpeg().toBuffer();
                        sent = await sock.sendMessage(jid, { image: converted, caption: cap, mimetype: 'image/jpeg' });
                    } catch {
                        sent = await sock.sendMessage(jid, { image: Buffer.from(ir.data), caption: cap, mimetype: 'image/jpeg' });
                    }
                }
            } catch (e) {}
        }

        // Try bot logo fallback
        if (!sent && article.botLogo) {
            try {
                const lr = await axios.get(article.botLogo, { responseType: 'arraybuffer', timeout: 10000 });
                if (lr.data?.length > 1000) {
                    sent = await sock.sendMessage(jid, { image: Buffer.from(lr.data), caption: cap, mimetype: 'image/png' });
                }
            } catch (e) {}
        }

        // Text fallback
        if (!sent) sent = await sock.sendMessage(jid, { text: cap });

        if (sent && sendReaction) {
            await sock.sendMessage(jid, { react: { text: randEmoji(REACTIONS), key: sent.key } });
        }
        return true;
    } catch (e) {
        try { await sock.sendMessage(jid, { text: cap }); return true; } catch { return false; }
    }
}

// ═══════════════════════════════════════════════════════
// 📰 SEND NEWS COMMAND
// ═══════════════════════════════════════════════════════

async function sendNewsCommand(sock, jid, db, isGroup) {
    if (!sock?.user) return;

    const statusMsg = await sock.sendMessage(jid, {
        text: box('📰 *FETCHING NEWS*', [
            '  ⏳ Getting latest headlines...',
            '  📡 Connecting to 15 sources',
        ])
    });
    await react(sock, jid, statusMsg.key, '⏳');

    try {
        const all = await fetchAllLatestNews();
        if (!all.length) {
            const sent = await sock.sendMessage(jid, {
                text: box('📭 *NO NEWS*', [
                    '  📭 No articles available right now',
                    '  💡 Try again in a few minutes',
                ])
            });
            await react(sock, jid, sent.key, '📭');
            return;
        }

        const urls = await db.urlsGet();
        const max = isGroup ? 5 : 8;
        const newArticles = all.filter(a => a.url && !urls.includes(a.url));

        if (!newArticles.length) {
            const sent = await sock.sendMessage(jid, {
                text: box('📭 *NO NEW NEWS*', [
                    `  📊 Total tracked: *${all.length}*`,
                    `  ⏱️ Auto updates every *${(config?.checkIntervalMs || 120000) / 1000}s*`,
                    '  💡 All articles already sent!',
                ])
            });
            await react(sock, jid, sent.key, '📭');
            return;
        }

        let sentCount = 0;
        for (const a of newArticles.slice(0, max)) {
            if (await sendNewsToJid(sock, jid, a, true)) {
                await db.urlsAdd(a.url);
                sentCount++;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        const sent = await sock.sendMessage(jid, {
            text: box('✅ *NEWS SENT*', [
                `  ✅ Sent: *${sentCount} articles*`,
                `  🆕 New available: *${newArticles.length}*`,
                `  📊 Total tracked: *${all.length}*`,
            ])
        });
        await react(sock, jid, sent.key, '✅');

    } catch (e) {
        console.error('❌ News error:', e.message);
        const sent = await sock.sendMessage(jid, {
            text: box('❌ *NEWS ERROR*', [
                '  ❌ Failed to fetch news',
                '  💡 Check your internet connection',
            ])
        });
        await react(sock, jid, sent.key, '❌');
    }
}

// ═══════════════════════════════════════════════════════
// 📰 AUTO NEWS CHECK
// ═══════════════════════════════════════════════════════

async function checkAndShareAllNewNews(sock, db, config) {
    if (!sock?.user) return;
    const newsGroupJid = config?.newsGroupJid;
    if (!newsGroupJid) return;
    if (await db.groupGet(newsGroupJid, 'isMuted', false)) return;

    try {
        const all = await fetchAllLatestNews();
        if (!all.length) return;

        const urls = await db.urlsGet();
        if (!urls.length) {
            for (const i of all) { if (i.url) await db.urlsAdd(i.url); }
            console.log('🆕 First run: marked ' + all.length + ' articles as sent');
            return;
        }

        let s = 0;
        for (const i of all) {
            if (!i.url || urls.includes(i.url)) continue;
            if (await sendNewsToJid(sock, newsGroupJid, { ...i, botLogo: config.botLogo }, true)) {
                await db.urlsAdd(i.url);
                s++;
            }
            await new Promise(r => setTimeout(r, 3000));
        }
        if (s > 0) console.log('✅ ' + s + ' new news sent');
    } catch (e) {
        console.error('❌ Auto news error:', e.message);
    }
}

// ═══════════════════════════════════════════════════════
// 📋 MENU COMMAND
// ═══════════════════════════════════════════════════════

async function handleMenuCommand(sock, jid, db, config, isOwner, isAdmin, isGroup) {
    const prefix = await db.get('prefix', '.');
    await sendMainMenu(sock, jid, db, config, isOwner, isAdmin, isGroup, prefix);
}

// ═══════════════════════════════════════════════════════
// 📊 STATS COMMAND
// ═══════════════════════════════════════════════════════

async function handleStatsCommand(sock, jid, db, config) {
    try {
        const s = await db.all();
        const uc = await db.urlsCount();
        const bans = await db.banAll();
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        const secs = Math.floor(uptime % 60);

        const savedCount = fs.existsSync(SAVE_FOLDER) ? fs.readdirSync(SAVE_FOLDER).length : 0;
        const statusCount = fs.existsSync(STATUS_FOLDER) ? fs.readdirSync(STATUS_FOLDER).length : 0;
        const vvCount = fs.existsSync(VV_FOLDER) ? fs.readdirSync(VV_FOLDER).length : 0;

        const statsText = box('📊 *BOT STATISTICS*', [
            divider('📈 News'),
            `  📰 News Sent    : *${uc}*`,
            `  📡 Sources      : *15*`,
            `  📝 Per Fetch    : *32 articles*`,
            `  ⏱️ Interval     : *${(config?.checkIntervalMs || 120000) / 1000}s*`,
            '',
            divider('💾 Media'),
            `  💾 Saved Media  : *${savedCount} files*`,
            `  🖤 Status Saved : *${statusCount} files*`,
            `  👁️ View Once    : *${vvCount} files*`,
            '',
            divider('⚙️ Settings'),
            `  📰 Auto News    : ${toggle(s.autoNewsEnabled)}`,
            `  🖤 Auto View    : ${toggle(s.autoStatusView)}`,
            `  🖤 Auto React   : ${toggle(s.autoStatusReact)}`,
            `  💾 Auto Save    : ${toggle(s.autoStatusSave)}`,
            `  🎵 Voice        : ${toggle(s.voiceReplyEnabled)}`,
            `  🔗 Anti-Link    : ${toggle(s.antiLinkEnabled)}`,
            '',
            divider('🤖 System'),
            `  ⏱️ Uptime       : *${hours}h ${mins}m ${secs}s*`,
            `  🚫 Banned Users : *${Array.isArray(bans) ? bans.length : 0}*`,
            `  🔧 Prefix       : *"${s.prefix || '.'}"*`,
            `  🌍 Mode         : *${(s.botMode || 'public').toUpperCase()}*`,
            `  📦 Version      : *v${config?.version || '9.0.2'}*`,
            `  🗄️ Database     : *JSON*`,
        ]);

        try {
            const lr = await axios.get(config?.botLogo, { responseType: 'arraybuffer', timeout: 10000 });
            if (lr.data?.length > 1000) {
                const se = await sock.sendMessage(jid, {
                    image: Buffer.from(lr.data),
                    caption: statsText,
                    mimetype: 'image/png'
                });
                await react(sock, jid, se.key, '📊');
            } else {
                const se = await sock.sendMessage(jid, { text: statsText });
                await react(sock, jid, se.key, '📊');
            }
        } catch (e) {
            const se = await sock.sendMessage(jid, { text: statsText });
            await react(sock, jid, se.key, '📊');
        }
    } catch (e) {
        console.error('Stats error:', e.message);
        await sock.sendMessage(jid, { text: '❌ *Error loading stats!*' });
    }
}

// ═══════════════════════════════════════════════════════
// ℹ️ ABOUT COMMAND
// ═══════════════════════════════════════════════════════

async function handleAboutCommand(sock, jid, config) {
    const sent = await sock.sendMessage(jid, {
        text: box('💝 *ABOUT NEWSBOT LK*', [
            divider('🤖 Bot Info'),
            `  📛 *Name:* ${config?.botName || 'NewsBot LK'}`,
            `  📦 *Version:* v${config?.version || '9.0.2'}`,
            `  👨‍💻 *Developer:* Charuka Mahesh`,
            `  🌍 *Country:* Sri Lanka 🇱🇰`,
            '',
            divider('📰 Features'),
            '  ✅ Auto news from 15 sources',
            '  ✅ Sinhala & English news',
            '  ✅ Sports, Cricket, Football',
            '  ✅ Auto status view & react',
            '  ✅ Voice reply system',
            '  ✅ Group management tools',
            '  ✅ Media save & view-once',
            '',
            divider('💝 Dedicated To'),
            '  💚 Umesha Sathyanjali',
            '  💚 Mithila',
            '  💚 Sharada',
            '',
            '  🦄 *Made with love in Sri Lanka* 🇱🇰',
        ])
    });
    await react(sock, jid, sent.key, '💝');
}


// ═══════════════════════════════════════
// ✏️ EDIT SENT MESSAGE
// ═══════════════════════════════════════
async function handleEditCommand(sock, msg, jid, text) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    if (!quoted?.stanzaId) {
        await sock.sendMessage(jid, { text: '💡 *Usage:* Reply to a bot message with `.edit new text`' });
        return;
    }
    const newText = text.replace(/^\.?edit\s+/, '').trim();
    if (!newText) { await sock.sendMessage(jid, { text: '💡 *Usage:* `.edit your new message`' }); return; }
    try {
        await sock.sendMessage(jid, { text: newText, edit: { remoteJid: jid, id: quoted.stanzaId, fromMe: true } });
    } catch { await sock.sendMessage(jid, { text: '❌ *Can only edit bot\'s own messages!*' }); }
}

// ═══════════════════════════════════════
// 💬 REACT WITH CUSTOM EMOJI
// ═══════════════════════════════════════
async function handleReactCommand(sock, msg, jid, text) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    const emoji = text.replace(/^\.?react\s+/, '').trim();
    if (!quoted?.stanzaId || !emoji) {
        await sock.sendMessage(jid, { text: '💡 *Usage:* Reply to a message with `.react 🔥`' });
        return;
    }
    await sock.sendMessage(jid, { react: { text: emoji, key: { id: quoted.stanzaId, remoteJid: jid, participant: quoted.participant } } });
}

// ═══════════════════════════════════════
// 📄 SEND DOCUMENT
// ═══════════════════════════════════════
async function handleDocumentCommand(sock, msg, jid) {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) { await sock.sendMessage(jid, { text: '💡 *Usage:* Reply to media with `.document`' }); return; }
    try {
        const baileys = await import('@whiskeysockets/baileys');
        const buffer = await baileys.downloadMediaMessage(
            { message: quotedMsg }, 'buffer', {},
            { logger: { info: () => {}, error: () => {}, warn: () => {} } }
        );
        await sock.sendMessage(jid, { document: buffer, mimetype: 'application/pdf', fileName: `document_${Date.now()}.pdf` });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed!*' }); }
}

// ═══════════════════════════════════════
// 🔍 SEARCH MESSAGES
// ═══════════════════════════════════════
async function handleSearchCommand(sock, jid, text) {
    const query = text.replace(/^\.?search\s+/, '').trim();
    if (!query) { await sock.sendMessage(jid, { text: '💡 *Usage:* `.search keyword`' }); return; }
    try {
        const results = await sock.searchMessages(query, jid, { pageSize: 25 });
        const count = results.messages?.length || 0;
        await sock.sendMessage(jid, { text: `🔍 Found *${count}* messages containing "*${query}*"` });
    } catch { await sock.sendMessage(jid, { text: '❌ *Search failed!*' }); }
}

// ═══════════════════════════════════════
// 🖼️ GET OWN PROFILE PICTURE
// ═══════════════════════════════════════
async function handleMyPpCommand(sock, jid) {
    try {
        const ppUrl = await sock.profilePictureUrl(sock.user.id, 'image');
        await sock.sendMessage(jid, { image: { url: ppUrl }, caption: '🖼️ *My Profile Picture*' });
    } catch { await sock.sendMessage(jid, { text: '❌ *No profile picture!*' }); }
}

// ═══════════════════════════════════════
// 💬 GET OWN ABOUT
// ═══════════════════════════════════════
async function handleMyAboutCommand(sock, jid) {
    try {
        const status = await sock.fetchStatus(sock.user.id);
        await sock.sendMessage(jid, { text: `💬 *My About:* ${status?.status || 'Not set'}` });
    } catch { await sock.sendMessage(jid, { text: '❌ *Failed to fetch!*' }); }
}

// Add to module.exports:
module.exports = {
    // ... existing exports ...
    handleEditCommand,
    handleReactCommand,
    handleDocumentCommand,
    handleSearchCommand,
    handleMyPpCommand,
    handleMyAboutCommand,
};

// ═══════════════════════════════════════════════════════
// 🆘 HELP COMMAND
// ═══════════════════════════════════════════════════════

async function handleHelpCommand(sock, jid, db, isOwner, isAdmin, isGroup) {
    const prefix = await db.get('prefix', '.');
    const sent = await sock.sendMessage(jid, {
        text: box('🆘 *QUICK HELP*', [
            divider('📰 News'),
            `  ${prefix}news       — Fetch latest news`,
            `  ${prefix}stats      — Bot statistics`,
            `  ${prefix}about      — About this bot`,
            '',
            divider('💾 Media'),
            `  ${prefix}save       — Save replied media`,
            `  ${prefix}vv         — Reveal view-once`,
            `  ${prefix}sticker    — Image to sticker`,
            `  ${prefix}toimg      — Sticker to image`,
            '',
            divider('👥 Group'),
            `  ${prefix}admins     — List admins`,
            `  ${prefix}members    — List members`,
            `  ${prefix}tagall     — Mention everyone`,
            `  ${prefix}poll Q     — Create a poll`,
            `  ${prefix}afk reason — Set AFK`,
            `  ${prefix}dice       — Roll a dice`,
            `  ${prefix}flip       — Coin flip`,
            `  ${prefix}quote      — Random quote`,
            `  ${prefix}8ball Q    — Magic 8 ball`,
            '',
            ...(isAdmin || isOwner ? [
                divider('🛡️ Admin'),
                `  ${prefix}kick @user  — Remove member`,
                `  ${prefix}warn @user  — Warn member`,
                `  ${prefix}mute        — Mute group`,
                `  ${prefix}close/open  — Lock/unlock`,
                `  ${prefix}antilink on — Anti-link`,
                '',
            ] : []),
            ...(isOwner ? [
                divider('👑 Owner'),
                `  ${prefix}settings    — All settings`,
                `  ${prefix}broadcast   — Mass message`,
                `  ${prefix}ban @user   — Ban user`,
                `  ${prefix}restart     — Restart bot`,
                `  ${prefix}ownerhelp   — Full owner list`,
                '',
            ] : []),
            `  💡 Use *${prefix}menu* for full menu`,
        ])
    });
    await react(sock, jid, sent.key, '🆘');
}

// ═══════════════════════════════════════════════════════
// 🏓 PING COMMAND
// ═══════════════════════════════════════════════════════

async function handlePingCommand(sock, jid) {
    const start = Date.now();
    const tempMsg = await sock.sendMessage(jid, { text: '🏓 *Pinging...*' });
    const ping = Date.now() - start;

    await sock.sendMessage(jid, {
        text: box('🏓 *PONG!*', [
            `  ⚡ Response: *${ping}ms*`,
            `  ${ping < 500 ? '🟢 Excellent' : ping < 1000 ? '🟡 Good' : '🔴 Slow'}`,
            `  ✅ Bot is *online*`,
        ]),
        edit: tempMsg.key
    });
    await react(sock, jid, tempMsg.key, ping < 500 ? '🟢' : ping < 1000 ? '🟡' : '🔴');
}

// ═══════════════════════════════════════════════════════
// ⏰ TIME COMMAND
// ═══════════════════════════════════════════════════════

async function handleTimeCommand(sock, jid) {
    const now = new Date();
    const sriLankaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Colombo' }));
    const sent = await sock.sendMessage(jid, {
        text: box('⏰ *CURRENT TIME*', [
            divider('🇱🇰 Sri Lanka'),
            `  🕐 *Time:* ${sriLankaTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
            `  📅 *Date:* ${sriLankaTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
            '',
            divider('🌍 UTC'),
            `  🕐 *Time:* ${now.toUTCString()}`,
        ])
    });
    await react(sock, jid, sent.key, '⏰');
}

// ═══════════════════════════════════════════════════════
// 🌤️ WEATHER COMMAND (Basic)
// ═══════════════════════════════════════════════════════

async function handleWeatherCommand(sock, jid, text) {
    const city = text.replace(/^\.?weather\s+/, '').trim() || 'Colombo';
    try {
        const res = await axios.get(
            `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
            { timeout: 10000 }
        );
        const data = res.data;
        const current = data.current_condition?.[0];
        const area = data.nearest_area?.[0];

        if (!current) throw new Error('No data');

        const areaName = area?.areaName?.[0]?.value || city;
        const country = area?.country?.[0]?.value || '';
        const temp = current.temp_C;
        const feels = current.FeelsLikeC;
        const humidity = current.humidity;
        const desc = current.weatherDesc?.[0]?.value || '';
        const wind = current.windspeedKmph;

        const sent = await sock.sendMessage(jid, {
            text: box(`🌤️ *WEATHER - ${areaName.toUpperCase()}*`, [
                `  📍 *Location:* ${areaName}, ${country}`,
                '',
                divider('🌡️ Temperature'),
                `  🌡️ *Temp:* ${temp}°C`,
                `  🤔 *Feels Like:* ${feels}°C`,
                `  💧 *Humidity:* ${humidity}%`,
                `  💨 *Wind:* ${wind} km/h`,
                '',
                divider('☁️ Condition'),
                `  ☁️ *${desc}*`,
            ])
        });
        await react(sock, jid, sent.key, '🌤️');
    } catch (e) {
        const sent = await sock.sendMessage(jid, {
            text: box('❌ *WEATHER ERROR*', [
                `  ❌ Could not fetch weather for *${city}*`,
                '  💡 Try: `.weather Colombo`',
            ])
        });
        await react(sock, jid, sent.key, '❌');
    }
}

// ═══════════════════════════════════════
// 📍 LOCATION MESSAGE
// ═══════════════════════════════════════

async function handleLocationCommand(sock, jid, text) {
    const args = text.replace(/^\.?location\s+/, '').trim().split(',');
    if (args.length < 2) {
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', [
                '  📝 `.location lat,lng`',
                '  💡 Example: `.location 6.9271,79.8612`',
            ])
        });
        return;
    }
    const lat = parseFloat(args[0]);
    const lng = parseFloat(args[1]);
    if (isNaN(lat) || isNaN(lng)) {
        await sock.sendMessage(jid, { text: '❌ *Invalid coordinates!*' });
        return;
    }
    const sent = await sock.sendMessage(jid, {
        location: { degreesLatitude: lat, degreesLongitude: lng }
    });
    await react(sock, jid, sent.key, '📍');
}

// ═══════════════════════════════════════
// 📇 SEND CONTACT (vCard)
// ═══════════════════════════════════════

async function handleSendContactCommand(sock, jid, text, sender) {
    const args = text.replace(/^\.?sendcontact\s+/, '').trim().split('|');
    if (args.length < 2) {
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', [
                '  📝 `.sendcontact Name | Number`',
                '  💡 Example: `.sendcontact Jeff | 94771234567`',
            ])
        });
        return;
    }
    const name = args[0].trim();
    const number = args[1].trim().replace(/[^0-9]/g, '');
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
    const sent = await sock.sendMessage(jid, {
        contacts: {
            displayName: name,
            contacts: [{ vcard }]
        }
    });
    await react(sock, jid, sent.key, '📇');
}

// ═══════════════════════════════════════
// 📌 PIN / UNPIN MESSAGE (real API)
// ═══════════════════════════════════════

async function handlePinCommand(sock, jid, msg, duration = 86400) {
    const quotedKey = msg.message?.extendedTextMessage?.contextInfo;
    if (!quotedKey?.stanzaId) {
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', [
                '  📌 Reply to a message with `.pin`',
                '  📌 `.pin 7d` — pin for 7 days',
                '  📌 `.pin 30d` — pin for 30 days',
            ])
        });
        return;
    }
    const sent = await sock.sendMessage(jid, {
        pin: {
            type: 1,
            time: duration,
            key: {
                id: quotedKey.stanzaId,
                remoteJid: jid,
                participant: quotedKey.participant,
                fromMe: false
            }
        }
    });
    await react(sock, jid, sent.key, '📌');
}

async function handleUnpinCommand(sock, jid, msg) {
    const quotedKey = msg.message?.extendedTextMessage?.contextInfo;
    if (!quotedKey?.stanzaId) {
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', ['  📌 Reply to a pinned message with `.unpin`'])
        });
        return;
    }
    const sent = await sock.sendMessage(jid, {
        pin: {
            type: 0,
            time: 0,
            key: {
                id: quotedKey.stanzaId,
                remoteJid: jid,
                participant: quotedKey.participant,
                fromMe: false
            }
        }
    });
    await react(sock, jid, sent.key, '✅');
}

// ═══════════════════════════════════════
// ⏳ CHAT-LEVEL DISAPPEARING MESSAGES
// ═══════════════════════════════════════

async function handleChatDisappearCommand(sock, jid, arg) {
    const durations = { '24h': 86400, '7d': 604800, '90d': 7776000, 'off': false };
    const val = durations[arg?.toLowerCase()];
    if (val === undefined) {
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', [
                '  📝 `.chatdisappear 24h / 7d / 90d / off`',
                '  ⏳ Sets disappearing messages for this chat',
            ])
        });
        return;
    }
    await sock.sendMessage(jid, {
        disappearingMessagesInChat: val
    });
    const sent = await sock.sendMessage(jid, {
        text: box('⏳ *DISAPPEARING MESSAGES*', [
            val === false ? '  ❌ Disabled for this chat' : `  ✅ Messages disappear after *${arg}*`,
        ])
    });
    await react(sock, jid, sent.key, val === false ? '❌' : '⏳');
}

// ═══════════════════════════════════════
// ↩️ FORWARD MESSAGE
// ═══════════════════════════════════════

async function handleForwardCommand(sock, jid, msg) {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) {
        await sock.sendMessage(jid, {
            text: box('💡 *USAGE*', ['  📝 Reply to a message with `.forward`'])
        });
        return;
    }
    // Reconstruct WAMessage for forwarding
    const forwardMsg = {
        key: {
            remoteJid: jid,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            participant: msg.message.extendedTextMessage.contextInfo.participant,
            fromMe: false
        },
        message: quotedMsg
    };
    const sent = await sock.sendMessage(jid, { forward: forwardMsg });
    await react(sock, jid, sent.key, '↩️');
}

// ═══════════════════════════════════════════════════════
// 🔤 TEXT TOOLS
// ═══════════════════════════════════════════════════════

async function handleTextTools(sock, jid, text, command) {

    if (command === '.upper' || command === 'upper') {
        const input = text.replace(/^\.?upper\s+/, '').trim();
        if (!input) { await sock.sendMessage(jid, { text: '💡 *Usage:* `.upper your text`' }); return; }
        const sent = await sock.sendMessage(jid, { text: box('🔤 *UPPERCASE*', [`  ${input.toUpperCase()}`]) });
        await react(sock, jid, sent.key, '🔤');
        return;
    }

    if (command === '.lower' || command === 'lower') {
        const input = text.replace(/^\.?lower\s+/, '').trim();
        if (!input) { await sock.sendMessage(jid, { text: '💡 *Usage:* `.lower YOUR TEXT`' }); return; }
        const sent = await sock.sendMessage(jid, { text: box('🔡 *LOWERCASE*', [`  ${input.toLowerCase()}`]) });
        await react(sock, jid, sent.key, '🔡');
        return;
    }

    if (command === '.reverse' || command === 'reverse') {
        const input = text.replace(/^\.?reverse\s+/, '').trim();
        if (!input) { await sock.sendMessage(jid, { text: '💡 *Usage:* `.reverse your text`' }); return; }
        const sent = await sock.sendMessage(jid, { text: box('🔄 *REVERSED*', [`  ${input.split('').reverse().join('')}`]) });
        await react(sock, jid, sent.key, '🔄');
        return;
    }

    if (command === '.count' || command === 'count') {
        const input = text.replace(/^\.?count\s+/, '').trim();
        if (!input) { await sock.sendMessage(jid, { text: '💡 *Usage:* `.count your text`' }); return; }
        const sent = await sock.sendMessage(jid, {
            text: box('🔢 *TEXT COUNT*', [
                `  📝 *Characters:* ${input.length}`,
                `  📊 *Words:* ${input.split(/\s+/).filter(w => w).length}`,
                `  📄 *Lines:* ${input.split('\n').length}`,
            ])
        });
        await react(sock, jid, sent.key, '🔢');
        return;
    }
}

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
    // ✅ New additions
    handleLocationCommand,
    handleSendContactCommand,
    handlePinCommand,
    handleUnpinCommand,
    handleChatDisappearCommand,
    handleForwardCommand,
};
