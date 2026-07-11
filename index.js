const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const Hiru = require('hirunews-scrap');
const Derana = require('ada-derana-news-scraper');

try { if (fs.existsSync(path.join(__dirname, 'app.pid'))) fs.unlinkSync(path.join(__dirname, 'app.pid')); } catch (e) {}

const GROUP_JID = process.env.GROUP_JID || '120363427636501059@g.us';
const OWNER_JID = process.env.OWNER_JID || '94784745155@s.whatsapp.net';
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS || 60000);
const STATE_FILE = path.join(__dirname, 'last-news.json');
const SAVE_FOLDER = path.join(__dirname, 'saved_media');

if (!fs.existsSync(SAVE_FOLDER)) fs.mkdirSync(SAVE_FOLDER, { recursive: true });

const BOT_LOGO = 'https://raw.githubusercontent.com/charukamahesh922-collab/NewsBot-LK/refs/heads/main/Assetes/botnews.png';
const ESANA_API_URL = 'https://esena-news-api-v3.vercel.app/';
const FALLBACK_IMAGE = 'https://raw.githubusercontent.com/charukamahesh922-collab/Mahawilachchiya-Sports/refs/heads/main/dearan.jpeg';

const STATUS_EMOJIS = ['❤️', '🔥', '👍', '💯', '👏', '😍', '✨', '🌟', '💫', '🎉'];
const reactions = ['📰', '🔥', '👍', '💯', '👏', '🏆', '⭐', '📢'];

let sock = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let isConnected = false;
let isShuttingDown = false;
let lastStatusProcessTime = 0;
const STATUS_COOLDOWN = 3000;

function loadState() { try { if (fs.existsSync(STATE_FILE)) { const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); if (!s.sentUrls) s.sentUrls = []; return s; } } catch (e) {} return { sentUrls: [] }; }
function saveState(s) { try { if (s.sentUrls?.length > 10000) s.sentUrls = s.sentUrls.slice(-10000); fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(s, null, 2)); fs.renameSync(STATE_FILE + '.tmp', STATE_FILE); } catch (e) {} }

async function autoReact(mid) { if (!sock || !mid) return; try { await sock.sendMessage(GROUP_JID, { react: { text: reactions[Math.floor(Math.random() * reactions.length)], key: mid } }); } catch (e) {} }

async function scrapeArticle(url) {
  try {
    const res = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    const html = res.data;
    const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (paragraphs) {
      return paragraphs.map(p => p.replace(/<[^>]*>/g, '').trim())
        .filter(p => p.length > 40 && !p.includes('function(') && !p.includes('Copyright') && !p.includes('var ') && !p.includes('Solution by') && !p.includes('Technology Partner') && !p.includes('Fortunacreatives'))
        .join('\n\n')
        .replace(/&zwj;/g, '').replace(/&zwnj;/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
    }
  } catch (e) {}
  return '';
}

// ==================== CONNECTION NOTICE WITH BOT LOGO ====================
async function sendConnectionNotice() {
  if (!isConnected || !sock?.user) return;
  const msg = `💝 News Bot 💝\n\n✅ Connected\n📡 6 Sources\n🔄 Every 1 min\n\n📋 /menu\n📰 /news\n📊 /stats\n💾 /save\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`;
  try { await sock.sendMessage(OWNER_JID, { image: { url: BOT_LOGO }, caption: msg, mimetype: 'image/png' }); console.log('📨 Connection sent with logo'); } catch (e) { await sock.sendMessage(OWNER_JID, { text: msg }); }
}

// ==================== MENU WITH BOT LOGO ====================
async function sendBotMenu(jid) {
  if (!isConnected || !sock?.user) return;
  const msg = `💝 News Bot 💝\n\n📌 *Commands*\n\n📋 /menu - Menu\n📰 /news - Fetch News\n📊 /stats - Statistics\n💾 /save - Save Media\n\n📡 *Sources*\nHiru | Derana | Esana\nAdaDerana | Cricket\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`;
  try { await sock.sendMessage(jid || GROUP_JID, { image: { url: BOT_LOGO }, caption: msg, mimetype: 'image/png' }); } catch (e) { await sock.sendMessage(jid || GROUP_JID, { text: msg }); }
}

async function autoViewAndReact(statusMsg) {
  if (!sock || !isConnected) return;
  const now = Date.now();
  if (now - lastStatusProcessTime < STATUS_COOLDOWN) return;
  try { const { key } = statusMsg; if (!key || key.fromMe) return; const so = key.participant || key.remoteJid; if (so === sock.user?.id) return; lastStatusProcessTime = now; await sock.readMessages([key]); const emoji = STATUS_EMOJIS[Math.floor(Math.random() * STATUS_EMOJIS.length)]; try { await sock.sendMessage('status@broadcast', { react: { text: emoji, key: key } }); } catch (e) {} } catch (err) {}
}

async function saveMedia(msg) {
  if (!sock || !msg) return null;
  try { const { message } = msg; const type = Object.keys(message)[0]; let buf = null, ext = '.bin'; if (type === 'imageMessage') { buf = await sock.downloadMediaMessage(msg); ext = '.jpg'; } else if (type === 'videoMessage') { buf = await sock.downloadMediaMessage(msg); ext = '.mp4'; } else if (type === 'stickerMessage') { buf = await sock.downloadMediaMessage(msg); ext = '.webp'; } if (buf) { const fp = path.join(SAVE_FOLDER, `saved_${Date.now()}${ext}`); fs.writeFileSync(fp, buf); return { fp, buf, type }; } } catch (e) {} return null;
}

async function startWhatsAppBot() {
  if (sock) return;
  const baileys = await import('@whiskeysockets/baileys');
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));
  sock = makeWASocket({ auth: state, browser: ['NewsBot', 'Chrome', '1.0.0'], markOnlineOnConnect: false, connectTimeoutMs: 30000 });

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
      
      if (lowerText.startsWith('/save') || lowerText.startsWith('#save')) {
        const ctx = msg.message.extendedTextMessage?.contextInfo;
        if (ctx?.quotedMessage && ctx?.stanzaId) {
          const fm = { key: { remoteJid: jid, id: ctx.stanzaId }, message: ctx.quotedMessage };
          const saved = await saveMedia(fm);
          if (saved) { const mt = Object.keys(ctx.quotedMessage)[0]; if (mt === 'imageMessage') await sock.sendMessage(jid, { image: saved.buf, caption: '💾 Saved!' }); else if (mt === 'videoMessage') await sock.sendMessage(jid, { video: saved.buf, caption: '💾 Saved!' }); else if (mt === 'stickerMessage') await sock.sendMessage(jid, { sticker: saved.buf }); }
          else await sock.sendMessage(jid, { text: '❌ Failed!' });
        } else await sock.sendMessage(jid, { text: '💡 Reply to media with /save' });
        continue;
      }
      if (lowerText === '/menu' || lowerText === '#menu' || lowerText === 'menu') await sendBotMenu(jid);
      else if (lowerText === '/news' || lowerText === '#news' || lowerText === 'news') { if (jid === GROUP_JID) await checkAndShareAllNewNews(); else await sock.sendMessage(jid, { text: '📰 Works only in group.' }); }
      else if (lowerText === '/stats' || lowerText === '#stats' || lowerText === 'stats') { const st = loadState(); await sock.sendMessage(jid, { image: { url: BOT_LOGO }, caption: `💝 News Bot 💝\n\n📊 *Stats*\n📰 Sent: *${st.sentUrls?.length || 0}*\n🔄 Every: *${CHECK_INTERVAL_MS/1000}s*\n📡 Sources: *6*\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`, mimetype: 'image/png' }); }
    }
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) { console.log('Scan QR:'); qrcode.generate(qr, { small: true }); reconnectAttempts = 0; }
    if (connection === 'close') { isConnected = false; sock = null; const code = lastDisconnect?.error?.output?.statusCode; if (code !== DisconnectReason.loggedOut && !isShuttingDown) { const delay = Math.min(30000, 5000 * (reconnectAttempts + 1)); reconnectAttempts++; reconnectTimer = setTimeout(async () => { reconnectTimer = null; await startWhatsAppBot(); }, delay); } }
    else if (connection === 'open') { isConnected = true; reconnectAttempts = 0; console.log('✅ WhatsApp connected'); await sendConnectionNotice(); await checkAndShareAllNewNews(); }
  });
  sock.ev.on('creds.update', saveCreds);
}

async function fetchHiruNews() { const api = new Hiru(); const cats = ['BreakingNews', 'MainNews', 'TrendingNews', 'InternationalNews', 'EntertainmentNews', 'BusinessNews']; const news = []; const seen = new Set(); for (const c of cats) { if (typeof api[c] !== 'function') continue; try { const i = await api[c](); const u = i?.results?.newsURL, t = i?.results?.title; if (u && !seen.has(u) && t) { seen.add(u); news.push({ source: '🇱🇰 Hiru', category: c.replace('News', ''), title: t, description: (i.results.news || '').replace(/\s+/g, ' ').trim(), url: u, image: i.results.thumb || '', date: i.results.date || '' }); } } catch (e) {} } return news; }

async function fetchDeranaNews() { const news = []; try { const r = await Derana.scrapeHotNews(); if (Array.isArray(r)) { for (const a of r.slice(0, 3)) { const u = a.url || '', t = a.title || ''; if (u && t) { let d = await scrapeArticle(u); if (!d || d.length < 50) { const f = [a.content, a.description, a.summary, a.text, a.body].filter(Boolean); d = f.length ? f.reduce((x, y) => (x?.length || 0) > (y?.length || 0) ? x : y) : t; } d = String(d).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); news.push({ source: '🔴 Derana', category: 'Hot', title: t, description: d, url: u, image: FALLBACK_IMAGE, date: a.time || '' }); await new Promise(r => setTimeout(r, 500)); } } } } catch (e) {} return news; }

async function fetchEsanaNews() { const news = []; try { const res = await axios.get(ESANA_API_URL, { timeout: 15000 }); const articles = res.data?.news_data?.data || []; for (const a of articles.slice(0, 3)) { const t = a.titleSi || a.titleEn || '', u = a.share_url || ''; let d = ''; if (a.contentSi && Array.isArray(a.contentSi)) { d = a.contentSi.map(i => (typeof i === 'string' ? i : (i.text || '')).replace(/<[^>]*>/g, '').trim()).filter(x => x.length > 5).join('\n\n'); } if (!d || d.length < 50) { for (const f of [a.descriptionSi, a.description, a.summary]) { if (typeof f === 'string' && f.length > d.length) d = f; } } if ((!d || d.length < 100) && u) { const sd = await scrapeArticle(u); if (sd.length > d.length) d = sd; } if (!d || d.length < 20 || d === t) continue; d = String(d).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); news.push({ source: '🟢 Esana', category: 'Latest', title: t, description: d, url: u, image: a.cover || a.thumb || FALLBACK_IMAGE, date: a.published || '' }); await new Promise(r => setTimeout(r, 500)); } } catch (e) {} return news; }

async function fetchAdaDeranaRSS() { const news = []; try { const r = await axios.get('https://www.adaderana.lk/rss.php', { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }); const reg = /<item>([\s\S]*?)<\/item>/gi; let m; while ((m = reg.exec(r.data)) !== null && news.length < 2) { const i = m[1], t = (i.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim() || '', u = (i.match(/<link>([^<]+)<\/link>/i) || [])[1]?.trim() || '', dt = (i.match(/<pubDate>([^<]+)<\/pubDate>/i) || [])[1]?.trim() || ''; let d = await scrapeArticle(u); if (!d || d.length < 50) d = (i.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]?.replace(/<[^>]*>/g, '').trim() || ''; d = d.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(); if (t && u && d && d.length > 50) news.push({ source: '📰 AdaDerana', category: 'Latest', title: t, description: d, url: u, image: FALLBACK_IMAGE, date: dt }); await new Promise(r => setTimeout(r, 500)); } } catch (e) {} return news; }

async function fetchSinhalaCricketNews() { const news = []; try { const api = new Hiru(); if (typeof api.SportNews === 'function') { const i = await api.SportNews(); const u = i?.results?.newsURL, t = i?.results?.title || '', d = (i?.results?.news || '').replace(/\s+/g, ' ').trim(); if (u && t && d) news.push({ source: '🏏🇱🇰 Cricket', category: 'Sinhala', title: t, description: d, url: u, image: FALLBACK_IMAGE, date: i.results.date || '' }); } } catch (e) {} return news; }

async function fetchEnglishCricketNews() { const news = []; try { const r = await axios.get('https://www.espncricinfo.com/rss/content/story/feeds/8.xml', { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }); const reg = /<item>([\s\S]*?)<\/item>/gi; let m; while ((m = reg.exec(r.data)) !== null && news.length < 2) { const i = m[1], t = (i.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim() || '', u = (i.match(/<link>([^<]+)<\/link>/i) || [])[1]?.trim() || '', dt = (i.match(/<pubDate>([^<]+)<\/pubDate>/i) || [])[1]?.trim() || ''; let d = (i.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]?.replace(/<[^>]*>/g, '').trim() || ''; const sd = await scrapeArticle(u); if (sd.length > 100) d = sd; d = d.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(); if (t && u && d) { news.push({ source: '🏏🌍 Cricket', category: 'Top News', title: t, description: d, url: u, image: FALLBACK_IMAGE, date: dt }); await new Promise(r => setTimeout(r, 500)); } } } catch (e) {} return news; }

async function fetchAllLatestNews() { const results = await Promise.allSettled([fetchHiruNews(), fetchDeranaNews(), fetchEsanaNews(), fetchAdaDeranaRSS(), fetchSinhalaCricketNews(), fetchEnglishCricketNews()]); const all = []; for (const r of results) { if (r.status === 'fulfilled') all.push(...r.value); } const uniq = []; const seen = new Set(); for (const n of all) { if (n.url && !seen.has(n.url)) { seen.add(n.url); uniq.push(n); } } return uniq; }

// ==================== SEND NEWS WITH BOT LOGO ALWAYS ====================
async function sendNewsToGroup(n) {
  if (!isConnected || !sock?.user) return false;
  const d = (n.description || '').replace(/\s+/g, ' ').trim();
  const msg = `💝 News Bot 💝\n\n${n.source} | ${n.category}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n${n.title}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n📌 ${d}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n${n.date ? `📅 ${n.date}\n\n` : ''}🔗 ${n.url}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`;
  try {
    if (n.image && n.image.length > 10 && !n.image.includes('dearan.jpeg')) { try { const s = await sock.sendMessage(GROUP_JID, { image: { url: n.image }, caption: msg, mimetype: 'image/jpeg' }); await autoReact(s.key); return true; } catch (e) {} }
    try { const s = await sock.sendMessage(GROUP_JID, { image: { url: BOT_LOGO }, caption: msg, mimetype: 'image/png' }); await autoReact(s.key); return true; } catch (e) {}
    const s = await sock.sendMessage(GROUP_JID, { text: msg }); await autoReact(s.key); return true;
  } catch (e) { return false; }
}

async function checkAndShareAllNewNews() {
  if (!isConnected || !sock?.user) return;
  try { const all = await fetchAllLatestNews(); if (!all.length) return; const state = loadState(); if (state.sentUrls.length === 0) { for (const item of all) { if (item.url) state.sentUrls.push(item.url); } saveState(state); console.log(`🆕 Marked ${state.sentUrls.length} as sent`); return; } let sent = 0; for (const item of all) { if (!item.url || state.sentUrls.includes(item.url)) continue; if (await sendNewsToGroup(item)) { state.sentUrls.push(item.url); sent++; saveState(state); } await new Promise(r => setTimeout(r, 3000)); } console.log(sent > 0 ? `✅ Sent ${sent}` : '📭 No new'); } catch (e) { console.error('Error:', e.message); }
}

(async () => { console.log('📰 NewsBot LK - 6 Sources'); await startWhatsAppBot(); setInterval(() => checkAndShareAllNewNews(), CHECK_INTERVAL_MS); })();
