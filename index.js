// ============================================
// 📰 NewsBot LK - Ultimate Bot
// 👨‍💻 By Charuka Mahesh
// 💛 Umesha Sathyanjali | Mithila | Sharada
// 🌐 https://charukamahesh922-collab.github.io/protifilo/
// ============================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const Hiru = require('hirunews-scrap');
const Derana = require('ada-derana-news-scraper');
const DY_NEWS = require('@dark-yasiya/news-scrap');
const dynews = new DY_NEWS();

try { if (fs.existsSync(path.join(__dirname, 'app.pid'))) fs.unlinkSync(path.join(__dirname, 'app.pid')); } catch (e) {}

const GROUP_JID = process.env.GROUP_JID || '120363427636501059@g.us';
const OWNER_JID = process.env.OWNER_JID || '94784745155@s.whatsapp.net';
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS || 60000);
const STATE_FILE = path.join(__dirname, 'last-news.json');
const SAVE_FOLDER = path.join(__dirname, 'saved_media');
const PORTFOLIO_URL = 'https://charukamahesh922-collab.github.io/protifilo/';

if (!fs.existsSync(SAVE_FOLDER)) fs.mkdirSync(SAVE_FOLDER, { recursive: true });

const BOT_LOGO = 'https://raw.githubusercontent.com/charukamahesh922-collab/NewsBot-LK/refs/heads/main/Assetes/botnews.png';
const ESANA_API_URL = 'https://esena-news-api-v3.vercel.app/';
const FALLBACK_IMAGE = 'https://raw.githubusercontent.com/charukamahesh922-collab/Mahawilachchiya-Sports/refs/heads/main/dearan.jpeg';

const STATUS_EMOJIS = ['❤️', '🔥', '👍', '💯', '👏', '😍', '✨', '🌟', '💫', '🎉'];
const NEWS_REACTIONS = ['📰', '🔥', '👍', '💯', '👏', '🏆', '⭐', '📢'];

// Feature data stores
const afkUsers = new Map();
const tags = {};
const autoReplies = {
    'hi': 'Hello! How can I help you?',
    'hello': 'Hi there! Type /menu for commands.',
    'thanks': 'You are welcome!',
    'good morning': 'Good Morning! Have a great day!',
    'good night': 'Good Night! Sweet dreams!',
    'bot': 'Yes, I am here! Type /menu for options.'
};
const quotes = [
    "The only way to do great work is to love what you do. - Steve Jobs",
    "Code is like humor. When you have to explain it, it's bad. - Cory House",
    "First, solve the problem. Then, write the code. - John Johnson",
    "Experience is the name everyone gives to their mistakes. - Oscar Wilde",
    "The best error message is the one that never shows up. - Thomas Fuchs"
];
const sinhalaNames = ['නිම්නා', 'සඳලි', 'රුවන්', 'කසුන්', 'දිල්ෂාන්', 'නදීෂා', 'චානුක', 'සජිත්'];
const truths = ["What is your biggest fear?", "What is your most embarrassing moment?", "Have you ever lied to your best friend?", "What is your secret talent?"];
const dares = ["Send a voice note singing a song!", "Change your profile picture to a cartoon!", "Send a message using only emojis!", "Take a selfie with a funny face!"];
let isMuted = false;

let sock = null, reconnectTimer = null, reconnectAttempts = 0;
let isConnected = false, isShuttingDown = false, lastStatusProcessTime = 0;
const STATUS_COOLDOWN = 3000;

function loadState() { try { if (fs.existsSync(STATE_FILE)) { const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); if (!s.sentUrls) s.sentUrls = []; return s; } } catch (e) {} return { sentUrls: [] }; }
function saveState(s) { try { if (s.sentUrls?.length > 15000) s.sentUrls = s.sentUrls.slice(-15000); fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(s, null, 2)); fs.renameSync(STATE_FILE + '.tmp', STATE_FILE); } catch (e) {} }

async function autoReact(mid) { if (!sock || !mid) return; try { await sock.sendMessage(GROUP_JID, { react: { text: NEWS_REACTIONS[Math.floor(Math.random() * NEWS_REACTIONS.length)], key: mid } }); } catch (e) {} }

async function scrapeArticleWithImage(url) {
  try { const res = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }); const html = res.data; const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi); let d = ''; if (paragraphs) { d = paragraphs.map(p => p.replace(/<[^>]*>/g, '').trim()).filter(p => p.length > 40 && !p.includes('function(') && !p.includes('Copyright') && !p.includes('var ') && !p.includes('Solution by') && !p.includes('Technology Partner') && !p.includes('Fortunacreatives') && !p.includes('HomeLatest') && !p.includes('SportsBusiness') && !p.includes('Science & Tech') && !p.includes('Top Picture') && !p.includes('Add Ada Derana') && !p.includes('Add on Google')).join('\n\n').replace(/&apos;/g, "'").replace(/&#x27;/g, "'").replace(/&zwj;/g, '').replace(/&zwnj;/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(); } let img = ''; const im = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i) || html.match(/<img[^>]*src="(https:\/\/[^"]*\.(?:jpg|jpeg|png|webp))"[^>]*>/i); if (im) { img = im[1]; if (img.startsWith('/')) img = new URL(url).origin + img; } return { description: d, image: img }; } catch (e) {} return { description: '', image: '' };
}

async function sendConnectionNotice() {
  if (!isConnected || !sock?.user) return;
  const msg = `💝 News Bot 💝\n\n✅ Connected\n📡 10 Sources | 20 Commands\n🔄 Every 1 min\n\n📋 /menu for all commands\n\n🌐 ${PORTFOLIO_URL}\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`;
  try { await sock.sendMessage(OWNER_JID, { image: { url: BOT_LOGO }, caption: msg, mimetype: 'image/png' }); } catch (e) {}
}

async function sendBotMenu(jid) {
  if (!isConnected || !sock?.user) return;
  const msg = `💝 News Bot 💝\n\n📌 *Commands*\n\n📰 /news - Fetch News\n📊 /stats - Statistics\n💾 /save - Save Media\n\n🎮 *Fun Commands*\n/joke /quote /flip /roll\n/truth /dare /name\n\n🛠️ *Utility*\n/calc /wiki /google /yt\n/ping /system /rules\n/afk /tag /get /tags\n/mute /unmute /poll\n/everyone /remind\n\n🌐 ${PORTFOLIO_URL}\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`;
  try { await sock.sendMessage(jid || GROUP_JID, { image: { url: BOT_LOGO }, caption: msg, mimetype: 'image/png' }); } catch (e) {}
}

async function autoViewAndReact(statusMsg) {
  if (!sock || !isConnected) return;
  const now = Date.now();
  if (now - lastStatusProcessTime < STATUS_COOLDOWN) return;
  try { const { key } = statusMsg; if (!key || key.fromMe) return; if ((key.participant || key.remoteJid) === sock.user?.id) return; lastStatusProcessTime = now; await sock.readMessages([key]); await sock.sendMessage('status@broadcast', { react: { text: STATUS_EMOJIS[Math.floor(Math.random() * STATUS_EMOJIS.length)], key: key } }); } catch (err) {}
}

async function saveMedia(msg) {
  if (!sock || !msg) return null;
  try { const t = Object.keys(msg.message)[0]; let b = null, e = '.bin'; if (t === 'imageMessage') { b = await sock.downloadMediaMessage(msg); e = '.jpg'; } else if (t === 'videoMessage') { b = await sock.downloadMediaMessage(msg); e = '.mp4'; } else if (t === 'stickerMessage') { b = await sock.downloadMediaMessage(msg); e = '.webp'; } if (b) { const fp = path.join(SAVE_FOLDER, `saved_${Date.now()}${e}`); fs.writeFileSync(fp, b); return { fp, buf: b, type: t }; } } catch (e) {} return null;
}

async function startWhatsAppBot() {
  if (sock) return;
  const baileys = await import('@whiskeysockets/baileys');
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));
  sock = makeWASocket({ auth: state, browser: ['NewsBot', 'Chrome', '1.0.0'], markOnlineOnConnect: false, connectTimeoutMs: 30000 });

  // Group update handler - Welcome new members
  sock.ev.on('group-participants.update', async (update) => {
    if (update.action === 'add' && update.id === GROUP_JID) {
      for (const participant of update.participants) {
        await sock.sendMessage(GROUP_JID, { text: `Welcome to the group! Type /menu to see what I can do.` });
      }
    }
  });

  // Message Handler
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
      const sender = msg.key.participant || jid;

      // AFK check for mentions
      if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
        for (const mentioned of msg.message.extendedTextMessage.contextInfo.mentionedJid) {
          if (afkUsers.has(mentioned)) {
            const afk = afkUsers.get(mentioned);
            const mins = Math.floor((Date.now() - afk.time) / 60000);
            await sock.sendMessage(jid, { text: `User is AFK: ${afk.reason}\nAway for ${mins} minutes` });
          }
        }
      }

      // Auto-reply to common words
      for (const [word, reply] of Object.entries(autoReplies)) {
        if (lowerText === word) {
          await sock.sendMessage(jid, { text: reply });
          return;
        }
      }

      // /save command
      if (lowerText === '/save' || lowerText === '#save') {
        const ctx = msg.message.extendedTextMessage?.contextInfo;
        if (ctx?.quotedMessage && ctx?.stanzaId) {
          const fm = { key: { remoteJid: jid, id: ctx.stanzaId }, message: ctx.quotedMessage };
          const saved = await saveMedia(fm);
          if (saved) { const mt = Object.keys(ctx.quotedMessage)[0]; if (mt === 'imageMessage') await sock.sendMessage(jid, { image: saved.buf, caption: '💾 Saved!' }); else if (mt === 'videoMessage') await sock.sendMessage(jid, { video: saved.buf, caption: '💾 Saved!' }); else if (mt === 'stickerMessage') await sock.sendMessage(jid, { sticker: saved.buf }); } else await sock.sendMessage(jid, { text: '❌ Failed!' });
        } else await sock.sendMessage(jid, { text: '💡 Reply to media with /save' });
        return;
      }

      // ============ NEWS COMMANDS ============
      if (lowerText === '/menu' || lowerText === '#menu' || lowerText === 'menu') { await sendBotMenu(jid); return; }
      if (lowerText === '/news' || lowerText === '#news' || lowerText === 'news') { if (jid === GROUP_JID) await checkAndShareAllNewNews(); else await sock.sendMessage(jid, { text: '📰 Works only in group.' }); return; }
      if (lowerText === '/stats' || lowerText === '#stats' || lowerText === 'stats') { const st = loadState(); await sock.sendMessage(jid, { image: { url: BOT_LOGO }, caption: `💝 News Bot 💝\n\n📊 *Stats*\n📰 Sent: *${st.sentUrls?.length || 0}*\n🔄 Every: *${CHECK_INTERVAL_MS/1000}s*\n📡 Sources: *10*\n\n🌐 ${PORTFOLIO_URL}\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`, mimetype: 'image/png' }); return; }

      // ============ FUN COMMANDS ============
      if (lowerText === '/joke') { try { const r = await axios.get('https://v2.jokeapi.dev/joke/Any?type=single', { timeout: 5000 }); await sock.sendMessage(jid, { text: `😂 ${r.data.joke}` }); } catch (e) { await sock.sendMessage(jid, { text: '😂 Why did the programmer quit? Because he didn\'t get arrays!' }); } return; }
      if (lowerText === '/quote') { await sock.sendMessage(jid, { text: `"${quotes[Math.floor(Math.random() * quotes.length)]}"` }); return; }
      if (lowerText === '/flip' || lowerText === '/coin') { await sock.sendMessage(jid, { text: Math.random() < 0.5 ? 'Heads!' : 'Tails!' }); return; }
      if (lowerText.startsWith('/roll')) { const max = parseInt(rawText.split(' ')[1]) || 6; await sock.sendMessage(jid, { text: `You rolled: ${Math.floor(Math.random() * max) + 1} (1-${max})` }); return; }
      if (lowerText === '/truth') { await sock.sendMessage(jid, { text: `Truth: ${truths[Math.floor(Math.random() * truths.length)]}` }); return; }
      if (lowerText === '/dare') { await sock.sendMessage(jid, { text: `Dare: ${dares[Math.floor(Math.random() * dares.length)]}` }); return; }
      if (lowerText === '/name') { await sock.sendMessage(jid, { text: `Name: ${sinhalaNames[Math.floor(Math.random() * sinhalaNames.length)]}` }); return; }

      // ============ UTILITY COMMANDS ============
      if (lowerText.startsWith('/calc ')) { try { const result = eval(rawText.replace('/calc', '').trim()); await sock.sendMessage(jid, { text: `Result: ${result}` }); } catch (e) { await sock.sendMessage(jid, { text: 'Invalid expression!' }); } return; }
      if (lowerText.startsWith('/wiki ')) { const q = rawText.replace('/wiki', '').trim(); try { const r = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`, { timeout: 10000 }); if (r.data.extract) { await sock.sendMessage(jid, { text: `*${r.data.title}*\n\n${r.data.extract.substring(0, 500)}...\n\n${r.data.content_urls.desktop.page}` }); } } catch (e) { await sock.sendMessage(jid, { text: 'Article not found!' }); } return; }
      if (lowerText.startsWith('/google ') || lowerText.startsWith('/g ')) { const q = rawText.replace('/google', '').replace('/g', '').trim(); await sock.sendMessage(jid, { text: `Search: https://www.google.com/search?q=${encodeURIComponent(q)}` }); return; }
      if (lowerText.startsWith('/youtube ') || lowerText.startsWith('/yt ')) { const q = rawText.replace('/youtube', '').replace('/yt', '').trim(); await sock.sendMessage(jid, { text: `Search: https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` }); return; }
      if (lowerText === '/ping') { const start = Date.now(); const m = await sock.sendMessage(jid, { text: 'Pinging...' }); await sock.sendMessage(jid, { text: `Pong! ${Date.now() - start}ms | Status: Online` }); return; }
      if (lowerText === '/system' || lowerText === '/sys') { const info = `*System*\nUptime: ${Math.floor(os.uptime()/3600)}h\nMemory: ${Math.floor(os.freemem()/1024/1024)}MB\nPlatform: ${os.platform()}\n\n🌐 ${PORTFOLIO_URL}`; await sock.sendMessage(jid, { text: info }); return; }
      if (lowerText === '/rules') { await sock.sendMessage(jid, { text: `*Group Rules*\n\n1. Be respectful\n2. No spam\n3. No offensive content\n4. Stay on topic\n5. Have fun!\n\n🌐 ${PORTFOLIO_URL}` }); return; }

      // ============ AFK SYSTEM ============
      if (lowerText.startsWith('/afk')) { const reason = rawText.replace('/afk', '').trim() || 'AFK'; afkUsers.set(sender, { reason, time: Date.now() }); await sock.sendMessage(jid, { text: `AFK: ${reason}` }); return; }

      // ============ TAG SYSTEM ============
      if (lowerText.startsWith('/tag ')) { const parts = rawText.split(' '); const tn = parts[1]; const tc = parts.slice(2).join(' '); if (!tags[tn]) tags[tn] = []; tags[tn].push(tc); await sock.sendMessage(jid, { text: `Tag "${tn}" saved!` }); return; }
      if (lowerText.startsWith('/get ')) { const tn = rawText.split(' ')[1]; if (tags[tn]) { await sock.sendMessage(jid, { text: `*${tn}:*\n${tags[tn].join('\n')}` }); } else { await sock.sendMessage(jid, { text: 'Tag not found!' }); } return; }
      if (lowerText === '/tags') { const tl = Object.keys(tags).join(', ') || 'No tags'; await sock.sendMessage(jid, { text: `Tags: ${tl}` }); return; }

      // ============ GROUP COMMANDS ============
      if (lowerText === '/mute' || lowerText === '/silence') { isMuted = true; await sock.sendMessage(jid, { text: 'Bot muted for 30 mins.' }); setTimeout(() => { isMuted = false; }, 30*60*1000); return; }
      if (lowerText === '/unmute' || lowerText === '/speak') { isMuted = false; await sock.sendMessage(jid, { text: 'Bot unmuted!' }); return; }
      if (lowerText.startsWith('/poll ')) { const q = rawText.replace('/poll', '').trim(); await sock.sendMessage(GROUP_JID, { poll: { name: q, values: ['Yes', 'No', 'Maybe'], selectableCount: 1 } }); return; }
      if (lowerText === '/everyone' || lowerText === '/all') { try { const meta = await sock.groupMetadata(GROUP_JID); const mentions = meta.participants.map(p => p.id); await sock.sendMessage(GROUP_JID, { text: 'Attention everyone!', mentions }); } catch (e) {} return; }
      if (lowerText.startsWith('/remind ')) { const parts = rawText.split(' '); const time = parseInt(parts[1]); const reminder = parts.slice(2).join(' '); await sock.sendMessage(jid, { text: `Reminder set for ${time} minutes!` }); setTimeout(async () => { await sock.sendMessage(jid, { text: `Reminder: ${reminder}` }); }, time*60*1000); return; }
    }
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) { console.log('Scan QR:'); qrcode.generate(qr, { small: true }); reconnectAttempts = 0; }
    if (connection === 'close') { isConnected = false; sock = null; const code = lastDisconnect?.error?.output?.statusCode; if (code !== DisconnectReason.loggedOut && !isShuttingDown) { const delay = Math.min(30000, 5000 * (reconnectAttempts + 1)); reconnectAttempts++; reconnectTimer = setTimeout(async () => { reconnectTimer = null; await startWhatsAppBot(); }, delay); } }
    else if (connection === 'open') { isConnected = true; reconnectAttempts = 0; console.log('✅ WhatsApp connected'); await sendConnectionNotice(); await checkAndShareAllNewNews(); }
  });
  sock.ev.on('creds.update', saveCreds);
}

// ==================== NEWS FUNCTIONS ====================
async function fetchHiruNews() { const a = new Hiru(); const c = ['BreakingNews','MainNews','TrendingNews','InternationalNews','EntertainmentNews','BusinessNews']; const n = []; const s = new Set(); for (const x of c) { if (typeof a[x] !== 'function') continue; try { const i = await a[x](); const u = i?.results?.newsURL, t = i?.results?.title; if (u && !s.has(u) && t) { s.add(u); n.push({ source: '🇱🇰 Hiru', category: x.replace('News',''), title: t, description: (i.results.news||'').replace(/\s+/g,' ').trim(), url: u, image: i.results.thumb||'', date: i.results.date||'' }); } } catch(e) {} } return n; }
async function fetchDeranaNews() { const n = []; try { const r = await Derana.scrapeHotNews(); if (Array.isArray(r)) { for (const a of r.slice(0,3)) { const u = a.url||'', t = a.title||''; if (u&&t) { const { description: sd, image: img } = await scrapeArticleWithImage(u); let d = sd; if (!d||d.length<50) { const f = [a.content,a.description,a.summary,a.text,a.body].filter(Boolean); d = f.length ? f.reduce((x,y)=>(x?.length||0)>(y?.length||0)?x:y) : t; } d = String(d).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); n.push({ source:'🔴 Derana', category:'Hot', title:t, description:d, url:u, image:img||FALLBACK_IMAGE, date:a.time||'' }); await new Promise(r=>setTimeout(r,500)); } } } } catch(e) {} return n; }
async function fetchEsanaNews() { const n = []; try { const r = await axios.get(ESANA_API_URL,{timeout:10000}); const a = r.data?.news_data?.data||[]; if (a.length>0) { for (const x of a.slice(0,3)) { const t = x.titleSi||x.titleEn||'', u = x.share_url||''; let d = ''; if (x.contentSi&&Array.isArray(x.contentSi)) { d = x.contentSi.map(i=>(typeof i==='string'?i:(i.text||'')).replace(/<[^>]*>/g,'').trim()).filter(x=>x.length>5).join('\n\n'); } if (!d||d.length<30) { for (const f of [x.descriptionSi,x.descriptionEn,x.description,x.summarySi,x.summary,x.content,x.body]) { if (typeof f==='string'&&f.length>d.length) d=f; } } if ((!d||d.length<50)&&u) { try { const { description: sd } = await scrapeArticleWithImage(u); if (sd.length>d.length) d=sd; } catch(e) {} } if (!d||d.length<10) continue; d = String(d).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); n.push({ source:'🟢 Esana', category:'Latest', title:t, description:d, url:u, image:x.cover||x.thumb||FALLBACK_IMAGE, date:x.published||'' }); await new Promise(r=>setTimeout(r,500)); } if (n.length>0) return n; } } catch(e) {} try { const r = await axios.get('https://www.helakuru.lk/esana',{timeout:15000,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}}); const h = r.data; const lr = /<a[^>]*href="(\/esana\/p\/\d+\/)"[^>]*>([^<]{25,})<\/a>/gi; let m; const ar = []; while ((m=lr.exec(h))!==null&&ar.length<3) { const u='https://www.helakuru.lk'+m[1], t=m[2].replace(/<[^>]*>/g,'').trim(); if (t.length>20&&!ar.find(a=>a.url===u)) ar.push({url:u,title:t}); } for (const a of ar) { if (n.length>=2) break; const { description: sd, image: img } = await scrapeArticleWithImage(a.url); let d=sd; d=d.replace(/&zwj;/g,'').replace(/&zwnj;/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); if (d&&d.length>100) { n.push({ source:'🟢 Esana', category:'Latest', title:a.title, description:d, url:a.url, image:img||FALLBACK_IMAGE, date:'' }); await new Promise(r=>setTimeout(r,500)); } } } catch(e) {} return n; }
async function fetchAdaDeranaRSS() { const n = []; try { const r = await axios.get('https://www.adaderana.lk/rss.php',{timeout:10000,headers:{'User-Agent':'Mozilla/5.0'}}); const reg = /<item>([\s\S]*?)<\/item>/gi; let m; while ((m=reg.exec(r.data))!==null&&n.length<2) { const i=m[1], t=(i.match(/<title>([^<]+)<\/title>/i)||[])[1]?.trim()||'', u=(i.match(/<link>([^<]+)<\/link>/i)||[])[1]?.trim()||'', dt=(i.match(/<pubDate>([^<]+)<\/pubDate>/i)||[])[1]?.trim()||''; const { description: sd, image: img } = await scrapeArticleWithImage(u); let d=sd; if (!d||d.length<50) d=(i.match(/<description>([\s\S]*?)<\/description>/i)||[])[1]?.replace(/<[^>]*>/g,'').trim()||''; d=d.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim(); if (t&&u&&d&&d.length>50) n.push({ source:'📰 AdaDerana', category:'Latest', title:t, description:d, url:u, image:img||FALLBACK_IMAGE, date:dt }); await new Promise(r=>setTimeout(r,500)); } } catch(e) {} return n; }
async function fetchFlashNews() { const n = []; try { const r = await axios.get('https://flashnews.lk/',{timeout:15000,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}}); const h = r.data; const ps = [/<a[^>]*href="(https:\/\/flashnews\.lk\/[^"]*\/)"[^>]*>([^<]{25,})<\/a>/gi,/<a[^>]*href="(\/[^"]*\/)"[^>]*>([^<]{25,})<\/a>/gi]; const ar = []; for (const p of ps) { let m; while ((m=p.exec(h))!==null&&ar.length<3) { let u=m[1]; const t=m[2].replace(/<[^>]*>/g,'').trim(); if (u.startsWith('/')) u='https://flashnews.lk'+u; if (t.length>20&&u.includes('flashnews.lk')&&!ar.find(a=>a.url===u)) ar.push({url:u,title:t}); } if (ar.length>0) break; } for (const a of ar) { if (n.length>=2) break; const { description: sd, image: img } = await scrapeArticleWithImage(a.url); let d=sd; d=d.replace(/&zwj;/g,'').replace(/&zwnj;/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); if (d&&d.length>100) { n.push({ source:'⚡ FlashNews', category:'Latest', title:a.title, description:d, url:a.url, image:img||FALLBACK_IMAGE, date:'' }); await new Promise(r=>setTimeout(r,500)); } } } catch(e) {} return n; }
async function fetchBBCSinhala() { const n = []; try { const r = await axios.get('https://www.bbc.com/sinhala',{timeout:15000,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}}); const h = r.data; const lr = /<a[^>]*href="(\/sinhala\/[^"]*)"[^>]*>([^<]{30,})<\/a>/gi; let m; const ar = []; while ((m=lr.exec(h))!==null&&ar.length<3) { const u='https://www.bbc.com'+m[1], t=m[2].replace(/<[^>]*>/g,'').trim(); if (t.length>20&&!ar.find(a=>a.url===u)) ar.push({url:u,title:t}); } for (const a of ar) { if (n.length>=2) break; const { description: sd, image: img } = await scrapeArticleWithImage(a.url); let d=sd; d=d.replace(/&zwj;/g,'').replace(/&zwnj;/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); if (d&&d.length>100) { n.push({ source:'🌍 BBC', category:'Sinhala', title:a.title, description:d, url:a.url, image:img||FALLBACK_IMAGE, date:'' }); await new Promise(r=>setTimeout(r,500)); } } } catch(e) {} return n; }
async function fetchAllCricketNews() { const an = []; try { const r = await axios.get('https://www.espncricinfo.com/rss/content/story/feeds/8.xml',{timeout:15000,headers:{'User-Agent':'Mozilla/5.0'}}); const reg = /<item>([\s\S]*?)<\/item>/gi; let m; while ((m=reg.exec(r.data))!==null&&an.length<2) { const i=m[1], t=(i.match(/<title>([^<]+)<\/title>/i)||[])[1]?.trim()||'', u=(i.match(/<link>([^<]+)<\/link>/i)||[])[1]?.trim()||'', dt=(i.match(/<pubDate>([^<]+)<\/pubDate>/i)||[])[1]?.trim()||''; const img=(i.match(/<media:content[^>]*url="([^"]*)"/i)||[])[1]?.trim()||''; const { description: sd } = await scrapeArticleWithImage(u); let d=sd; if (!d||d.length<100) d=(i.match(/<description>([\s\S]*?)<\/description>/i)||[])[1]?.replace(/<[^>]*>/g,'').trim()||''; d=d.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim(); if (t&&u&&d) an.push({ source:'🏏 ESPN', category:'Cricket', title:t, description:d, url:u, image:img||FALLBACK_IMAGE, date:dt }); } } catch(e) {} try { const api=new Hiru(); if (typeof api.SportNews==='function') { const i=await api.SportNews(); const u=i?.results?.newsURL, t=i?.results?.title||'', d=(i?.results?.news||'').replace(/\s+/g,' ').trim(); if (u&&t&&d) an.push({ source:'🏏🇱🇰 Cricket', category:'Sinhala', title:t, description:d, url:u, image:i.results.thumb||FALLBACK_IMAGE, date:i.results.date||'' }); } } catch(e) {} return an; }
async function fetchAdaLkNews() { const n = []; try { const r = await dynews.ada(); if (r?.status && r?.result) { const x = r.result; if (x.url && x.title) { const d = (x.desc || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(); if (d.length > 50) { n.push({ source: '📰 Ada.lk', category: 'Latest', title: x.title, description: d, url: x.url, image: x.image || FALLBACK_IMAGE, date: `${x.date} ${x.time}` || '' }); } } } } catch (e) {} return n; }
async function fetchNewswireNews() { const n = []; try { const r = await dynews.newswire(); if (r?.status && r?.result) { const x = r.result; if (x.url && x.title) { const d = (x.desc || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(); if (d.length > 50) { n.push({ source: '📰 Newswire', category: 'Latest', title: x.title, description: d, url: x.url, image: x.image || FALLBACK_IMAGE, date: `${x.date} ${x.time}` || '' }); } } } } catch (e) {} return n; }
async function fetchSirasaNews() { const n = []; try { const r = await dynews.sirasa(); if (r?.status && r?.result) { const x = r.result; if (x.url && x.title) { const d = (x.desc || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(); if (d.length > 50) { n.push({ source: '📺 Sirasa', category: 'Latest', title: x.title, description: d, url: x.url, image: x.image || FALLBACK_IMAGE, date: `${x.date} ${x.time}` || '' }); } } } } catch (e) {} return n; }

async function fetchAllLatestNews() {
  console.log('\n📰 ===== FETCHING =====');
  const sources = [
    { name: 'Hiru', fn: fetchHiruNews }, { name: 'Derana', fn: fetchDeranaNews }, { name: 'Esana', fn: fetchEsanaNews },
    { name: 'AdaDerana', fn: fetchAdaDeranaRSS }, { name: 'FlashNews', fn: fetchFlashNews }, { name: 'BBC', fn: fetchBBCSinhala },
    { name: 'Cricket', fn: fetchAllCricketNews }, { name: 'Ada.lk', fn: fetchAdaLkNews }, { name: 'Newswire', fn: fetchNewswireNews },
    { name: 'Sirasa', fn: fetchSirasaNews }
  ];
  const results = await Promise.allSettled(sources.map(s => s.fn()));
  const all = [];
  sources.forEach((source, index) => {
    const result = results[index];
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      if (result.value.length > 0) { console.log(`  ✅ ${source.name}: ${result.value.length}`); all.push(...result.value); }
      else { console.log(`  ⚠️ ${source.name}: 0`); }
    } else { console.log(`  ❌ ${source.name}: Failed`); }
  });
  const uniq = []; const seen = new Set();
  for (const n of all) { if (n.url && !seen.has(n.url)) { seen.add(n.url); uniq.push(n); } }
  console.log(`📊 Unique: ${uniq.length}\n`);
  return uniq;
}

async function sendNewsToGroup(n) {
  if (!isConnected || !sock?.user) return false;
  const d = (n.description || '').replace(/\s+/g, ' ').trim();
  const msg = `💝 News Bot 💝\n\n${n.source} | ${n.category}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n${n.title}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n📌 ${d}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n${n.date ? `📅 ${n.date}\n\n` : ''}🔗 ${n.url}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n🌐 ${PORTFOLIO_URL}\n\nＢʏ Ｃʜᴀʀᴜᴋᴀ Ｍᴀʜᴇꜱʜ\n💛 Umesha & Mithila`;
  try {
    if (n.image && n.image.length > 10 && !n.image.includes('dearan.jpeg')) { try { const s = await sock.sendMessage(GROUP_JID, { image: { url: n.image }, caption: msg, mimetype: 'image/jpeg' }); await autoReact(s.key); return true; } catch (e) {} }
    try { const s = await sock.sendMessage(GROUP_JID, { image: { url: BOT_LOGO }, caption: msg, mimetype: 'image/png' }); await autoReact(s.key); return true; } catch (e) {}
    const s = await sock.sendMessage(GROUP_JID, { text: msg }); await autoReact(s.key); return true;
  } catch (e) { return false; }
}

async function checkAndShareAllNewNews() {
  if (!isConnected || !sock?.user) return;
  if (isMuted) { console.log('Bot muted, skipping'); return; }
  try {
    const all = await fetchAllLatestNews(); if (!all.length) return;
    const state = loadState();
    if (state.sentUrls.length === 0) { for (const item of all) { if (item.url) state.sentUrls.push(item.url); } saveState(state); console.log(`🆕 Marked ${state.sentUrls.length} as sent`); return; }
    let sent = 0;
    for (const item of all) { if (!item.url || state.sentUrls.includes(item.url)) continue; if (await sendNewsToGroup(item)) { state.sentUrls.push(item.url); sent++; saveState(state); } await new Promise(r => setTimeout(r, 3000)); }
    console.log(sent > 0 ? `✅ Sent ${sent}` : '📭 No new');
  } catch (e) { console.error('Error:', e.message); }
}

(async () => { console.log('📰 NewsBot LK - Ultimate\n🌐 ' + PORTFOLIO_URL); await startWhatsAppBot(); setInterval(() => checkAndShareAllNewNews(), CHECK_INTERVAL_MS); })();
