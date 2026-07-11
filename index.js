// ============================================
// 📰 NewsBot LK - Multi-Source WhatsApp News Bot
// 👨‍💻 By Charuka Mahesh
// 💛 Umesha Sathyanjali | Mithila | Sharada
// ============================================

const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const Hiru = require('hirunews-scrap');
const Derana = require('ada-derana-news-scraper');
const DY_NEWS = require('@dark-yasiya/news-scrap');
const dynews = new DY_NEWS();

// Clean PID file
try { if (fs.existsSync(path.join(__dirname, 'app.pid'))) fs.unlinkSync(path.join(__dirname, 'app.pid')); } catch (e) {}

// ============================================
// CONFIGURATION
// ============================================
const GROUP_JID = process.env.GROUP_JID || '120363427636501059@g.us';
const OWNER_JID = process.env.OWNER_JID || '94784745155@s.whatsapp.net';
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS || 60000);
const STATE_FILE = path.join(__dirname, 'last-news.json');
const SAVE_FOLDER = path.join(__dirname, 'saved_media');

if (!fs.existsSync(SAVE_FOLDER)) fs.mkdirSync(SAVE_FOLDER, { recursive: true });

// ============================================
// CONSTANTS
// ============================================
const BOT_LOGO = 'https://raw.githubusercontent.com/charukamahesh922-collab/NewsBot-LK/refs/heads/main/Assetes/botnews.png';
const ESANA_API_URL = 'https://esena-news-api-v3.vercel.app/';
const FALLBACK_IMAGE = 'https://raw.githubusercontent.com/charukamahesh922-collab/Mahawilachchiya-Sports/refs/heads/main/dearan.jpeg';
const STATUS_EMOJIS = ['❤️', '🔥', '👍', '💯', '👏', '😍', '✨', '🌟', '💫', '🎉'];
const NEWS_REACTIONS = ['📰', '🔥', '👍', '💯', '👏', '🏆', '⭐', '📢'];

// ============================================
// GLOBAL VARIABLES
// ============================================
let sock = null, reconnectTimer = null, reconnectAttempts = 0;
let isConnected = false, isShuttingDown = false, lastStatusProcessTime = 0;
const STATUS_COOLDOWN = 3000;

// ============================================
// STATE MANAGEMENT
// ============================================
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            if (!s.sentUrls) s.sentUrls = [];
            return s;
        }
    } catch (e) {}
    return { sentUrls: [] };
}

function saveState(s) {
    try {
        if (s.sentUrls?.length > 15000) s.sentUrls = s.sentUrls.slice(-15000);
        fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(s, null, 2));
        fs.renameSync(STATE_FILE + '.tmp', STATE_FILE);
    } catch (e) {}
}

// ============================================
// HELPER FUNCTIONS
// ============================================
async function autoReact(mid) {
    if (!sock || !mid) return;
    try {
        await sock.sendMessage(GROUP_JID, {
            react: { text: NEWS_REACTIONS[Math.floor(Math.random() * NEWS_REACTIONS.length)], key: mid }
        });
    } catch (e) {}
}

async function scrapeArticleWithImage(url) {
    try {
        const res = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = res.data;
        const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        let d = '';
        if (paragraphs) {
            d = paragraphs.map(p => p.replace(/<[^>]*>/g, '').trim())
                .filter(p => p.length > 40 && !p.includes('function(') && !p.includes('Copyright') && !p.includes('var '))
                .join('\n\n')
                .replace(/&zwj;/g, '').replace(/&zwnj;/g, '').replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
        }
        let img = '';
        const im = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i) ||
            html.match(/<img[^>]*src="(https:\/\/[^"]*\.(?:jpg|jpeg|png|webp))"[^>]*>/i);
        if (im) { img = im[1]; if (img.startsWith('/')) img = new URL(url).origin + img; }
        return { description: d, image: img };
    } catch (e) {}
    return { description: '', image: '' };
}

// ============================================
// BOT MESSAGES
// ============================================
async function sendConnectionNotice() {
    if (!isConnected || !sock?.user) return;
    const msg = `💝 News Bot 💝\n\n✅ Connected\n📡 10 Sources\n🔄 Every 1 min\n\n📋 /menu\n📰 /news\n📊 /stats\n💾 /save\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`;
    try { await sock.sendMessage(OWNER_JID, { image: { url: BOT_LOGO }, caption: msg, mimetype: 'image/png' }); console.log('📨 Connection sent'); } catch (e) {}
}

async function sendBotMenu(jid) {
    if (!isConnected || !sock?.user) return;
    const target = jid || GROUP_JID;
    const msg = `💝 News Bot 💝\n\n📌 *Commands*\n\n📋 /menu - Show Menu\n📰 /news - Fetch News\n📊 /stats - Statistics\n💾 /save - Save Media\n\n📡 *Sources (10)*\nHiru | Derana | Esana\nAdaDerana | FlashNews | BBC\nAda.lk | Newswire | Sirasa\nCricket (ESPN + Sinhala)\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`;
    try { await sock.sendMessage(target, { image: { url: BOT_LOGO }, caption: msg, mimetype: 'image/png' }); console.log('📋 Menu sent'); } catch (e) {}
}

// ============================================
// STATUS AUTO-VIEW & REACT
// ============================================
async function autoViewAndReact(statusMsg) {
    if (!sock || !isConnected) return;
    const now = Date.now();
    if (now - lastStatusProcessTime < STATUS_COOLDOWN) return;
    try {
        const { key } = statusMsg;
        if (!key || key.fromMe) return;
        if ((key.participant || key.remoteJid) === sock.user?.id) return;
        lastStatusProcessTime = now;
        await sock.readMessages([key]);
        await sock.sendMessage('status@broadcast', {
            react: { text: STATUS_EMOJIS[Math.floor(Math.random() * STATUS_EMOJIS.length)], key: key }
        });
        console.log('👁️💬 Status reacted');
    } catch (err) {}
}

// ============================================
// MEDIA SAVE
// ============================================
async function saveMedia(msg) {
    if (!sock || !msg) return null;
    try {
        const t = Object.keys(msg.message)[0];
        let b = null, e = '.bin';
        if (t === 'imageMessage') { b = await sock.downloadMediaMessage(msg); e = '.jpg'; }
        else if (t === 'videoMessage') { b = await sock.downloadMediaMessage(msg); e = '.mp4'; }
        else if (t === 'stickerMessage') { b = await sock.downloadMediaMessage(msg); e = '.webp'; }
        if (b) { const fp = path.join(SAVE_FOLDER, `saved_${Date.now()}${e}`); fs.writeFileSync(fp, b); return { fp, buf: b, type: t }; }
    } catch (e) {}
    return null;
}

// ============================================
// WHATSAPP CONNECTION
// ============================================
async function startWhatsAppBot() {
    if (sock) return;
    const baileys = await import('@whiskeysockets/baileys');
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));
    sock = makeWASocket({ auth: state, browser: ['NewsBot', 'Chrome', '1.0.0'], markOnlineOnConnect: false, connectTimeoutMs: 30000 });

    // MESSAGE HANDLER
    sock.ev.on('messages.upsert', async (m) => {
        if (!isConnected) return;
        for (const msg of m.messages) {
            if (!msg.message) continue;
            const jid = msg.key.remoteJid;

            if (jid === 'status@broadcast') { await autoViewAndReact(msg); continue; }
            if (msg.key.fromMe) continue;

            let rawText = '';
            if (msg.message.conversation) rawText = msg.message.conversation;
            else if (msg.message.extendedTextMessage?.text) rawText = msg.message.extendedTextMessage.text;
            else if (msg.message.imageMessage?.caption) rawText = msg.message.imageMessage.caption;
            else if (msg.message.videoMessage?.caption) rawText = msg.message.videoMessage.caption;

            const lowerText = rawText.trim().toLowerCase();
            console.log(`📩 Command: "${lowerText}" from ${jid.substring(0, 15)}...`);

            // /save command
            if (lowerText === '/save' || lowerText === '#save') {
                const ctx = msg.message.extendedTextMessage?.contextInfo;
                if (ctx?.quotedMessage && ctx?.stanzaId) {
                    const fm = { key: { remoteJid: jid, id: ctx.stanzaId }, message: ctx.quotedMessage };
                    const saved = await saveMedia(fm);
                    if (saved) {
                        const mt = Object.keys(ctx.quotedMessage)[0];
                        if (mt === 'imageMessage') await sock.sendMessage(jid, { image: saved.buf, caption: '💾 Saved!' });
                        else if (mt === 'videoMessage') await sock.sendMessage(jid, { video: saved.buf, caption: '💾 Saved!' });
                        else if (mt === 'stickerMessage') await sock.sendMessage(jid, { sticker: saved.buf });
                    } else await sock.sendMessage(jid, { text: '❌ Failed! Reply to an image/video with /save' });
                } else await sock.sendMessage(jid, { text: '💡 Reply to an image/video/sticker with /save' });
                continue;
            }

            // Commands
            if (lowerText === '/menu' || lowerText === '#menu' || lowerText === 'menu') {
                await sendBotMenu(jid);
            } else if (lowerText === '/news' || lowerText === '#news' || lowerText === 'news') {
                if (jid === GROUP_JID) {
                    await sock.sendMessage(jid, { text: '📰 Fetching latest news...' });
                    await checkAndShareAllNewNews();
                } else {
                    await sock.sendMessage(jid, { text: '📰 This command works only in the group.' });
                }
            } else if (lowerText === '/stats' || lowerText === '#stats' || lowerText === 'stats') {
                const st = loadState();
                await sock.sendMessage(jid, {
                    image: { url: BOT_LOGO },
                    caption: `💝 News Bot 💝\n\n📊 *Statistics*\n\n📰 Articles Sent: *${st.sentUrls?.length || 0}*\n🔄 Check Interval: *${CHECK_INTERVAL_MS / 1000}s*\n📡 Sources: *10*\n☁️ Hosting: *24/7 Cloud*\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`,
                    mimetype: 'image/png'
                });
            }
        }
    });

    // CONNECTION HANDLER
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) { console.log('📱 Scan QR code below:'); qrcode.generate(qr, { small: true }); reconnectAttempts = 0; }
        if (connection === 'close') {
            isConnected = false; sock = null;
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut && !isShuttingDown) {
                const delay = Math.min(30000, 5000 * (reconnectAttempts + 1));
                reconnectAttempts++;
                console.log(`⏳ Reconnecting in ${delay / 1000}s...`);
                reconnectTimer = setTimeout(async () => { reconnectTimer = null; await startWhatsAppBot(); }, delay);
            }
        } else if (connection === 'open') {
            isConnected = true; reconnectAttempts = 0;
            console.log('✅ WhatsApp connected!');
            await sendConnectionNotice();
            await checkAndShareAllNewNews();
        }
    });
    sock.ev.on('creds.update', saveCreds);
}

// ============================================
// NEWS SOURCES - EXISTING
// ============================================
async function fetchHiruNews() { const a = new Hiru(); const c = ['BreakingNews','MainNews','TrendingNews','InternationalNews','EntertainmentNews','BusinessNews']; const n = []; const s = new Set(); for (const x of c) { if (typeof a[x] !== 'function') continue; try { const i = await a[x](); const u = i?.results?.newsURL, t = i?.results?.title; if (u && !s.has(u) && t) { s.add(u); n.push({ source: '🇱🇰 Hiru', category: x.replace('News',''), title: t, description: (i.results.news||'').replace(/\s+/g,' ').trim(), url: u, image: i.results.thumb||'', date: i.results.date||'' }); } } catch(e) {} } return n; }
async function fetchDeranaNews() { const n = []; try { const r = await Derana.scrapeHotNews(); if (Array.isArray(r)) { for (const a of r.slice(0,3)) { const u = a.url||'', t = a.title||''; if (u&&t) { const { description: sd, image: img } = await scrapeArticleWithImage(u); let d = sd; if (!d||d.length<50) { const f = [a.content,a.description,a.summary,a.text,a.body].filter(Boolean); d = f.length ? f.reduce((x,y)=>(x?.length||0)>(y?.length||0)?x:y) : t; } d = String(d).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); n.push({ source:'🔴 Derana', category:'Hot', title:t, description:d, url:u, image:img||FALLBACK_IMAGE, date:a.time||'' }); await new Promise(r=>setTimeout(r,500)); } } } } catch(e) {} return n; }
async function fetchEsanaNews() { const n = []; try { const r = await axios.get(ESANA_API_URL,{timeout:15000}); const a = r.data?.news_data?.data||[]; for (const x of a.slice(0,3)) { const t = x.titleSi||x.titleEn||'', u = x.share_url||''; let d = ''; if (x.contentSi&&Array.isArray(x.contentSi)) { d = x.contentSi.map(i=>(typeof i==='string'?i:(i.text||'')).replace(/<[^>]*>/g,'').trim()).filter(x=>x.length>5).join('\n\n'); } if (!d||d.length<50) { for (const f of [x.descriptionSi,x.description,x.summary]) { if (typeof f==='string'&&f.length>d.length) d=f; } } if ((!d||d.length<100)&&u) { const { description: sd } = await scrapeArticleWithImage(u); if (sd.length>d.length) d=sd; } if (!d||d.length<20||d===t) continue; d = String(d).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); n.push({ source:'🟢 Esana', category:'Latest', title:t, description:d, url:u, image:x.cover||x.thumb||FALLBACK_IMAGE, date:x.published||'' }); await new Promise(r=>setTimeout(r,500)); } } catch(e) {} return n; }
async function fetchAdaDeranaRSS() { const n = []; try { const r = await axios.get('https://www.adaderana.lk/rss.php',{timeout:10000,headers:{'User-Agent':'Mozilla/5.0'}}); const reg = /<item>([\s\S]*?)<\/item>/gi; let m; while ((m=reg.exec(r.data))!==null&&n.length<2) { const i=m[1], t=(i.match(/<title>([^<]+)<\/title>/i)||[])[1]?.trim()||'', u=(i.match(/<link>([^<]+)<\/link>/i)||[])[1]?.trim()||'', dt=(i.match(/<pubDate>([^<]+)<\/pubDate>/i)||[])[1]?.trim()||''; const { description: sd, image: img } = await scrapeArticleWithImage(u); let d=sd; if (!d||d.length<50) d=(i.match(/<description>([\s\S]*?)<\/description>/i)||[])[1]?.replace(/<[^>]*>/g,'').trim()||''; d=d.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim(); if (t&&u&&d&&d.length>50) n.push({ source:'📰 AdaDerana', category:'Latest', title:t, description:d, url:u, image:img||FALLBACK_IMAGE, date:dt }); await new Promise(r=>setTimeout(r,500)); } } catch(e) {} return n; }
async function fetchFlashNews() { const n = []; try { const r = await axios.get('https://flashnews.lk/',{timeout:15000,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}}); const h = r.data; const ps = [/<a[^>]*href="(https:\/\/flashnews\.lk\/[^"]*\/)"[^>]*>([^<]{25,})<\/a>/gi,/<a[^>]*href="(\/[^"]*\/)"[^>]*>([^<]{25,})<\/a>/gi]; const ar = []; for (const p of ps) { let m; while ((m=p.exec(h))!==null&&ar.length<3) { let u=m[1]; const t=m[2].replace(/<[^>]*>/g,'').trim(); if (u.startsWith('/')) u='https://flashnews.lk'+u; if (t.length>20&&u.includes('flashnews.lk')&&!ar.find(a=>a.url===u)) ar.push({url:u,title:t}); } if (ar.length>0) break; } for (const a of ar) { if (n.length>=2) break; const { description: sd, image: img } = await scrapeArticleWithImage(a.url); let d=sd; d=d.replace(/&zwj;/g,'').replace(/&zwnj;/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); if (d&&d.length>100) { n.push({ source:'⚡ FlashNews', category:'Latest', title:a.title, description:d, url:a.url, image:img||FALLBACK_IMAGE, date:'' }); await new Promise(r=>setTimeout(r,500)); } } } catch(e) {} return n; }
async function fetchBBCSinhala() { const n = []; try { const r = await axios.get('https://www.bbc.com/sinhala',{timeout:15000,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}}); const h = r.data; const lr = /<a[^>]*href="(\/sinhala\/[^"]*)"[^>]*>([^<]{30,})<\/a>/gi; let m; const ar = []; while ((m=lr.exec(h))!==null&&ar.length<3) { const u='https://www.bbc.com'+m[1], t=m[2].replace(/<[^>]*>/g,'').trim(); if (t.length>20&&!ar.find(a=>a.url===u)) ar.push({url:u,title:t}); } for (const a of ar) { if (n.length>=2) break; const { description: sd, image: img } = await scrapeArticleWithImage(a.url); let d=sd; d=d.replace(/&zwj;/g,'').replace(/&zwnj;/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); if (d&&d.length>100) { n.push({ source:'🌍 BBC', category:'Sinhala', title:a.title, description:d, url:a.url, image:img||FALLBACK_IMAGE, date:'' }); await new Promise(r=>setTimeout(r,500)); } } } catch(e) {} return n; }
async function fetchAllCricketNews() { const an = []; try { const r = await axios.get('https://www.espncricinfo.com/rss/content/story/feeds/8.xml',{timeout:15000,headers:{'User-Agent':'Mozilla/5.0'}}); const reg = /<item>([\s\S]*?)<\/item>/gi; let m; while ((m=reg.exec(r.data))!==null&&an.length<2) { const i=m[1], t=(i.match(/<title>([^<]+)<\/title>/i)||[])[1]?.trim()||'', u=(i.match(/<link>([^<]+)<\/link>/i)||[])[1]?.trim()||'', dt=(i.match(/<pubDate>([^<]+)<\/pubDate>/i)||[])[1]?.trim()||''; const img=(i.match(/<media:content[^>]*url="([^"]*)"/i)||[])[1]?.trim()||''; const { description: sd } = await scrapeArticleWithImage(u); let d=sd; if (!d||d.length<100) d=(i.match(/<description>([\s\S]*?)<\/description>/i)||[])[1]?.replace(/<[^>]*>/g,'').trim()||''; d=d.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim(); if (t&&u&&d) an.push({ source:'🏏 ESPN', category:'Cricket', title:t, description:d, url:u, image:img||FALLBACK_IMAGE, date:dt }); } } catch(e) {} try { const api=new Hiru(); if (typeof api.SportNews==='function') { const i=await api.SportNews(); const u=i?.results?.newsURL, t=i?.results?.title||'', d=(i?.results?.news||'').replace(/\s+/g,' ').trim(); if (u&&t&&d) an.push({ source:'🏏🇱🇰 Cricket', category:'Sinhala', title:t, description:d, url:u, image:i.results.thumb||FALLBACK_IMAGE, date:i.results.date||'' }); } } catch(e) {} return an; }

// ============================================
// NEWS SOURCES - DARK-YASIYA (WORKING)
// ============================================
async function fetchAdaLkNews() { const n = []; try { const r = await dynews.ada(); if (r?.status && r?.result) { const x = r.result; if (x.url && x.title) { const d = (x.desc || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(); if (d.length > 50) { n.push({ source: '📰 Ada.lk', category: 'Latest', title: x.title, description: d, url: x.url, image: x.image || FALLBACK_IMAGE, date: `${x.date} ${x.time}` || '' }); } } } } catch (e) {} return n; }
async function fetchNewswireNews() { const n = []; try { const r = await dynews.newswire(); if (r?.status && r?.result) { const x = r.result; if (x.url && x.title) { const d = (x.desc || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(); if (d.length > 50) { n.push({ source: '📰 Newswire', category: 'Latest', title: x.title, description: d, url: x.url, image: x.image || FALLBACK_IMAGE, date: `${x.date} ${x.time}` || '' }); } } } } catch (e) {} return n; }
async function fetchSirasaNews() { const n = []; try { const r = await dynews.sirasa(); if (r?.status && r?.result) { const x = r.result; if (x.url && x.title) { const d = (x.desc || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(); if (d.length > 50) { n.push({ source: '📺 Sirasa', category: 'Latest', title: x.title, description: d, url: x.url, image: x.image || FALLBACK_IMAGE, date: `${x.date} ${x.time}` || '' }); } } } } catch (e) {} return n; }

// ============================================
// FETCH ALL WITH LOGGING
// ============================================
async function fetchAllLatestNews() {
    console.log('\n📰 ===== FETCHING =====');

    const sources = [
        { name: 'Hiru', fn: fetchHiruNews },
        { name: 'Derana', fn: fetchDeranaNews },
        { name: 'Esana', fn: fetchEsanaNews },
        { name: 'AdaDerana', fn: fetchAdaDeranaRSS },
        { name: 'FlashNews', fn: fetchFlashNews },
        { name: 'BBC', fn: fetchBBCSinhala },
        { name: 'Cricket', fn: fetchAllCricketNews },
        { name: 'Ada.lk', fn: fetchAdaLkNews },
        { name: 'Newswire', fn: fetchNewswireNews },
        { name: 'Sirasa', fn: fetchSirasaNews }
    ];

    const results = await Promise.allSettled(sources.map(s => s.fn()));
    const all = [];

    sources.forEach((source, index) => {
        const result = results[index];
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            if (result.value.length > 0) {
                console.log(`  ✅ ${source.name}: ${result.value.length} articles`);
                all.push(...result.value);
            } else {
                console.log(`  ⚠️ ${source.name}: 0 articles`);
            }
        } else {
            console.log(`  ❌ ${source.name}: Failed`);
        }
    });

    const uniq = [];
    const seen = new Set();
    for (const n of all) {
        if (n.url && !seen.has(n.url)) { seen.add(n.url); uniq.push(n); }
    }

    console.log(`📊 Total: ${uniq.length} unique articles`);
    console.log('📰 ===== DONE =====\n');
    return uniq;
}

// ============================================
// SEND NEWS
// ============================================
async function sendNewsToGroup(n) {
    if (!isConnected || !sock?.user) return false;
    const d = (n.description || '').replace(/\s+/g, ' ').trim();
    const msg = `💝 News Bot 💝\n\n${n.source} | ${n.category}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n${n.title}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n📌 ${d}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n${n.date ? `📅 ${n.date}\n\n` : ''}🔗 ${n.url}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`;

    try {
        if (n.image && n.image.length > 10 && !n.image.includes('dearan.jpeg')) {
            try {
                const s = await sock.sendMessage(GROUP_JID, { image: { url: n.image }, caption: msg, mimetype: 'image/jpeg' });
                await autoReact(s.key);
                console.log(`📤 [IMG] ${n.source}`);
                return true;
            } catch (e) {}
        }
        try {
            const s = await sock.sendMessage(GROUP_JID, { image: { url: BOT_LOGO }, caption: msg, mimetype: 'image/png' });
            await autoReact(s.key);
            console.log(`📤 [LOGO] ${n.source}`);
            return true;
        } catch (e) {}
        const s = await sock.sendMessage(GROUP_JID, { text: msg });
        await autoReact(s.key);
        console.log(`📤 [TXT] ${n.source}`);
        return true;
    } catch (e) { return false; }
}

// ============================================
// CHECK & SHARE
// ============================================
async function checkAndShareAllNewNews() {
    if (!isConnected || !sock?.user) return;
    try {
        const all = await fetchAllLatestNews();
        if (!all.length) return;

        const state = loadState();

        if (state.sentUrls.length === 0) {
            for (const item of all) { if (item.url) state.sentUrls.push(item.url); }
            saveState(state);
            console.log(`🆕 First run - marked ${state.sentUrls.length} as sent`);
            return;
        }

        let sent = 0;
        for (const item of all) {
            if (!item.url || state.sentUrls.includes(item.url)) continue;
            if (await sendNewsToGroup(item)) { state.sentUrls.push(item.url); sent++; saveState(state); }
            await new Promise(r => setTimeout(r, 3000));
        }
        console.log(sent > 0 ? `✅ Sent ${sent} articles` : '📭 No new');
    } catch (e) { console.error('Error:', e.message); }
}

// ============================================
// START BOT
// ============================================
(async () => {
    console.log('╔══════════════════════════╗');
    console.log('║    📰 NewsBot LK        ║');
    console.log('║    👨‍💻 Charuka Mahesh    ║');
    console.log('║    💛 Umesha & Mithila  ║');
    console.log('║    📡 10 News Sources   ║');
    console.log('║    🔄 Every 1 Minute    ║');
    console.log('╚══════════════════════════╝\n');
    await startWhatsAppBot();
    setInterval(() => checkAndShareAllNewNews(), CHECK_INTERVAL_MS);
})();
