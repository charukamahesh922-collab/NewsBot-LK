const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const Hiru = require('hirunews-scrap');
const Derana = require('ada-derana-news-scraper');

const GROUP_JID = process.env.GROUP_JID || ''; //👈 CHANGE THIS to your WhatsApp group JID
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS || 120000);
const STATE_FILE = path.join(__dirname, 'last-news.json');
const PID_FILE = path.join(__dirname, 'app.pid');

const DERANA_FALLBACK_IMAGE = ''; //👈 CHANGE THIS to your Fallback Image  Url
const CRICKET_FALLBACK_IMAGE = ''; //👈 CHANGE THIS to your WhatsApp group JID

let sock = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let isConnected = false;
let isShuttingDown = false;

async function ensureSingleInstance() {
  let stalePid = null;
  try {
    const existingPid = fs.readFileSync(PID_FILE, 'utf8').trim();
    if (existingPid && existingPid !== String(process.pid)) {
      try {
        process.kill(Number(existingPid), 0);
        stalePid = Number(existingPid);
        console.log(`Stopping previous instance ${stalePid}...`);
        process.kill(stalePid, 'SIGTERM');
      } catch { fs.unlinkSync(PID_FILE); }
    }
  } catch {}

  if (stalePid) {
    const started = Date.now();
    while (Date.now() - started < 5000) {
      try { process.kill(stalePid, 0); await new Promise(r => setTimeout(r, 250)); } 
      catch { break; }
    }
    try { process.kill(stalePid, 'SIGKILL'); } catch {}
  }
  fs.writeFileSync(PID_FILE, String(process.pid));
}

function releaseSingleInstance() {
  try { if (fs.readFileSync(PID_FILE, 'utf8').trim() === String(process.pid)) fs.unlinkSync(PID_FILE); } catch {}
}

process.on('exit', releaseSingleInstance);
process.on('SIGINT', () => { isShuttingDown = true; releaseSingleInstance(); process.exit(0); });
process.on('SIGTERM', () => { isShuttingDown = true; releaseSingleInstance(); process.exit(0); });

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (!state.sentUrls || !Array.isArray(state.sentUrls)) state.sentUrls = [];
      return state;
    }
  } catch (err) {}
  return { sentUrls: [] };
}

function saveState(state) {
  try {
    if (state.sentUrls?.length > 5000) state.sentUrls = state.sentUrls.slice(-5000);
    fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(state, null, 2));
    fs.renameSync(STATE_FILE + '.tmp', STATE_FILE);
  } catch (err) {}
}

// ==================== AUTO REACTIONS ====================
const reactions = ['📰', '🔥', '👍', '💯', '👏', '🏆', '⭐', '📢'];

async function autoReact(messageId) {
  if (!sock || !messageId) return;
  try {
    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
    await sock.sendMessage(GROUP_JID, {
      react: {
        text: randomReaction,
        key: messageId
      }
    });
  } catch (err) {}
}

// ==================== BOT MENU ====================
async function sendBotMenu() {
  if (!isConnected || !sock || !sock.user) return;

  const menuMessage = 
    `╭═══════════════════╮\n` +
    `       📰 *News Bot* 📰\n` +
    `     By Charuka Mahesh\n` +
    `╰═══════════════════╯\n\n` +
    `📌 *Available Commands:*\n\n` +
    `📋 */menu* - Show this menu\n` +
    `📰 */news* - Fetch latest news now\n` +
    `ℹ️ */info* - Bot information\n` +
    `📊 */stats* - Show stats\n\n` +
    `📡 *News Sources:*\n` +
    `🇱🇰 Hiru News\n` +
    `🔴 Derana News\n` +
    `🏏🇱🇰 Sinhala Cricket\n` +
    `🏏🌍 English Cricket\n\n` +
    `🔄 Auto-check: Every 2 mins\n\n` +
    `🙏 *Special Thanks:*\n` +
    `❤️ Umesha Sathyanjali\n` +
    `❤️ Mithila\n` +
    `_\`© 2026 News Bot\`_`;

  try { await sock.sendMessage(GROUP_JID, { text: menuMessage }); } catch (err) {}
}

async function sendBotInfo() {
  const infoMessage = 
    `╭═══════════════════╮\n` +
    `       📰 *News Bot* 📰\n` +
    `     By Charuka Mahesh\n` +
    `╰═══════════════════╯\n\n` +
    `📡 *Monitored Sources:*\n` +
    `✅ Hiru News (6 categories)\n` +
    `✅ Derana News (Hot News)\n` +
    `✅ Sinhala Cricket News\n` +
    `✅ English Cricket News (ESPN)\n\n` +
    `⚙️ *Features:*\n` +
    `🔄 Auto-check every 2 mins\n` +
    `📸 Images with news\n` +
    `📝 Full descriptions\n` +
    `🎯 Duplicate detection\n\n` +
    `🙏 *Credits:*\n` +
    `👨‍💻 Charuka Mahesh\n` +
    `❤️ Umesha Sathyanjali\n` +
    `❤️ Mithila\n`;

  try { await sock.sendMessage(GROUP_JID, { text: infoMessage }); } catch (err) {}
}

// ==================== MESSAGE HANDLER ====================
sock?.ev?.on('messages.upsert', async (m) => {
  if (!isConnected) return;
  
  for (const msg of m.messages) {
    if (!msg.message || msg.key.fromMe) continue;
    
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const isGroup = msg.key.remoteJid === GROUP_JID;
    
    if (!isGroup) continue;
    
    if (text === '/menu' || text === '#menu' || text === 'menu') {
      await sendBotMenu();
    } else if (text === '/news' || text === '#news' || text === 'news') {
      await checkAndShareAllNewNews();
    } else if (text === '/info' || text === '#info' || text === 'info') {
      await sendBotInfo();
    } else if (text === '/stats' || text === '#stats' || text === 'stats') {
      const state = loadState();
      const statsMsg = 
        `📊 *Bot Stats*\n\n` +
        `📰 Articles sent: ${state.sentUrls?.length || 0}\n` +
        `🔄 Check interval: ${CHECK_INTERVAL_MS / 1000}s\n` +
        `📅 Running since: 24/7 on cloud ☁️`;
      await sock.sendMessage(GROUP_JID, { text: statsMsg });
    }
  }
});

async function startWhatsAppBot() {
  if (sock) return;

  const baileys = await import('@whiskeysockets/baileys');
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));

  sock = makeWASocket({
    auth: state,
    browser: ['NewsBot', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    connectTimeoutMs: 30000
  });

  // Set up message handler
  sock.ev.on('messages.upsert', async (m) => {
    if (!isConnected) return;
    
    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue;
      
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      const isGroup = msg.key.remoteJid === GROUP_JID;
      
      if (!isGroup) continue;
      
      if (text === '/menu' || text === '#menu' || text === 'menu') {
        await sendBotMenu();
      } else if (text === '/news' || text === '#news' || text === 'news') {
        await checkAndShareAllNewNews();
      } else if (text === '/info' || text === '#info' || text === 'info') {
        await sendBotInfo();
      } else if (text === '/stats' || text === '#stats' || text === 'stats') {
        const state = loadState();
        const statsMsg = 
          `📊 *Bot Stats*\n\n` +
          `📰 Articles sent: ${state.sentUrls?.length || 0}\n` +
          `🔄 Check interval: ${CHECK_INTERVAL_MS / 1000}s\n` +
          `📅 Running 24/7 on cloud ☁️`;
        await sock.sendMessage(GROUP_JID, { text: statsMsg });
      }
    }
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('Scan QR code in WhatsApp:');
      qrcode.generate(qr, { small: true });
      reconnectAttempts = 0;
    }

    if (connection === 'close') {
      isConnected = false;
      sock = null;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || '';
      const isReplaced = statusCode === DisconnectReason.connectionReplaced || errorMessage.includes('replaced') || errorMessage.includes('conflict');
      const shouldReconnect = !isReplaced && statusCode !== DisconnectReason.loggedOut && !isShuttingDown;
      
      if (isReplaced) {
        console.log('Session replaced. Stopping.');
        if (reconnectTimer) clearTimeout(reconnectTimer);
        return;
      }
      
      if (shouldReconnect) {
        if (reconnectTimer) return;
        const delay = Math.min(30000, 5000 * (reconnectAttempts + 1));
        reconnectAttempts += 1;
        reconnectTimer = setTimeout(async () => {
          reconnectTimer = null;
          await startWhatsAppBot();
        }, delay);
      }
    } else if (connection === 'open') {
      isConnected = true;
      reconnectAttempts = 0;
      console.log('✅ WhatsApp connected');
      await sendConnectionNotice();
      await checkAndShareAllNewNews();
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// ==================== HIRU NEWS ====================
async function fetchHiruNews() {
  const api = new Hiru();
  const categories = [
    'BreakingNews', 'MainNews', 'TrendingNews',
    'InternationalNews', 'EntertainmentNews', 'BusinessNews'
  ];
  const news = [];
  const seenUrls = new Set();

  for (const category of categories) {
    if (typeof api[category] !== 'function') continue;
    try {
      const newsItem = await api[category]();
      const url = newsItem?.results?.newsURL;
      const title = newsItem?.results?.title;
      if (url && seenUrls.has(url)) continue;
      if (url && title) {
        seenUrls.add(url);
        news.push({
          source: '🇱🇰 Hiru',
          category: category.replace('News', ''),
          title: title,
          description: (newsItem.results.news || '').replace(/\s+/g, ' ').trim(),
          url: url,
          image: newsItem.results.thumb || '',
          date: newsItem.results.date || ''
        });
      }
    } catch (err) {}
  }
  return news;
}

// ==================== DERANA NEWS (FIXED) ====================
async function fetchDeranaNews() {
  const news = [];
  try {
    if (typeof Derana.scrapeHotNews === 'function') {
      const result = await Derana.scrapeHotNews();
      if (Array.isArray(result) && result.length > 0) {
        result.slice(0, 5).forEach(article => {
          const articleUrl = article.url || '';
          const articleTitle = article.title || '';
          if (articleUrl && articleTitle) {
            // Get the longest description from all fields
            let description = '';
            const descFields = ['content', 'description', 'summary', 'text', 'body', 'fullText'];
            for (const field of descFields) {
              if (article[field] && article[field].length > description.length) {
                description = article[field];
              }
            }
            if (!description) description = articleTitle;
            
            // Clean description - preserve full text
            description = description
              .replace(/<[^>]*>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/\s+/g, ' ')
              .trim();
            
            console.log(`🔴 Derana: ${articleTitle.substring(0, 50)}... [${description.length} chars]`);
            
            news.push({
              source: '🔴 Derana',
              category: 'Hot News',
              title: articleTitle,
              description: description,
              url: articleUrl,
              image: DERANA_FALLBACK_IMAGE, // Always use GitHub image
              date: article.time || ''
            });
          }
        });
      }
    }
  } catch (err) {}
  return news;
}

// ==================== SINHALA CRICKET NEWS ====================
async function fetchSinhalaCricketNews() {
  const news = [];
  try {
    const api = new Hiru();
    const sportsCategories = ['SportNews', 'SportsNews'];
    
    for (const category of sportsCategories) {
      if (typeof api[category] !== 'function') continue;
      try {
        const newsItem = await api[category]();
        const url = newsItem?.results?.newsURL;
        const title = newsItem?.results?.title || '';
        const description = (newsItem?.results?.news || '').replace(/\s+/g, ' ').trim();
        
        const cricketKeywords = [
          'ක්‍රිකට්', 'cricket', 'Cricket', 'ටෙස්ට්', 'එක්දින', 
          'විස්සයි20', 'T20', 'ODI', 'පන්දු', 'දැවී', 'ලකුණු',
          'ඉනිම', 'පිතිකරු', 'පන්දු යවන්නා', 'කඩුල්ල'
        ];
        
        const isCricket = cricketKeywords.some(keyword => 
          title.includes(keyword) || description.includes(keyword)
        );
        
        if (url && title && isCricket && description) {
          news.push({
            source: '🏏🇱🇰 Cricket',
            category: 'Sinhala Cricket',
            title: title,
            description: description,
            url: url,
            image: CRICKET_FALLBACK_IMAGE,
            date: newsItem.results.date || ''
          });
        }
      } catch (err) {}
    }
  } catch (err) {}
  return news;
}

// ==================== ENGLISH CRICKET NEWS ====================
async function fetchEnglishCricketNews() {
  const news = [];
  try {
    const response = await axios.get('https://www.espncricinfo.com/rss/content/story/feeds/8.xml', {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const xml = response.data;
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    const articles = [];
    
    while ((match = itemRegex.exec(xml)) !== null && articles.length < 3) {
      const item = match[1];
      articles.push({
        title: (item.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim() || '',
        url: (item.match(/<link>([^<]+)<\/link>/i) || [])[1]?.trim() || '',
        summary: (item.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]?.replace(/<[^>]*>/g, '').trim() || '',
        date: (item.match(/<pubDate>([^<]+)<\/pubDate>/i) || [])[1]?.trim() || ''
      });
    }
    
    for (const article of articles) {
      try {
        const artRes = await axios.get(article.url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const paragraphs = artRes.data.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        let description = article.summary;
        if (paragraphs) {
          const full = paragraphs.map(p => p.replace(/<[^>]*>/g, '').trim()).filter(p => p.length > 30).join('\n\n');
          if (full.length > 100) description = full;
        }
        description = description.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
        
        news.push({
          source: '🏏🌍 Cricket',
          category: 'English Cricket',
          title: article.title,
          description: description,
          url: article.url,
          image: CRICKET_FALLBACK_IMAGE,
          date: article.date
        });
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {}
    }
  } catch (err) {}
  return news;
}

// ==================== COMBINED FETCH ====================
async function fetchAllLatestNews() {
  const [hiruNews, deranaNews, sinhalaCricket, englishCricket] = await Promise.all([
    fetchHiruNews(), fetchDeranaNews(), fetchSinhalaCricketNews(), fetchEnglishCricketNews()
  ]);

  const allNews = [...hiruNews, ...deranaNews, ...sinhalaCricket, ...englishCricket];
  const uniqueNews = [];
  const seenUrls = new Set();

  for (const news of allNews) {
    if (news.url && !seenUrls.has(news.url)) {
      seenUrls.add(news.url);
      uniqueNews.push(news);
    }
  }
  return uniqueNews;
}

async function sendConnectionNotice() {
  if (!isConnected || !sock || !sock.user) return;

  const message = 
    `╭═══════════════════╮\n` +
    `       📰 *News Bot* 📰\n` +
    `     By Charuka Mahesh\n` +
    `╰═══════════════════╯\n\n` +
    `✅ Bot Connected!\n\n` +
    `📡 *Sources:*\n` +
    `🇱🇰 Hiru | 🔴 Derana\n` +
    `🏏 Sinhala & English Cricket\n\n` +
    `🔄 Auto-check every 2 mins\n\n` +
    `📋 Type */menu* for commands\n\n` +
    `🙏 Umesha | Mithila`;

  try { await sock.sendMessage(GROUP_JID, { text: message }); } catch (err) {}
}

// ==================== SEND NEWS WITH IMAGES ====================
async function sendNewsToGroup(newsItem) {
  if (!isConnected || !sock || !sock.user) return false;

  const title = newsItem.title || 'News';
  const description = (newsItem.description || '').replace(/\s+/g, ' ').trim();
  const url = newsItem.url || '';
  const date = newsItem.date || '';
  const source = newsItem.source || '';
  const category = newsItem.category || '';
  const image = newsItem.image || '';

  const message = 
    `╭───────────────────╮\n` +
    `    📰 *News Bot* 📰\n` +
    `  By Charuka Mahesh\n` +
    `╰───────────────────╯\n\n` +
    `${source} | 📂 ${category}\n\n` +
    `*${title}*\n\n` +
    `📌 ${description}\n\n` +
    `${date ? `📅 ${date}\n\n` : ''}` +
    `🔗 ${url}\n\n` +
    `_\`🙏 Umesha | Mithila\`_`;

  try {
    // Try sending with image
    if (image) {
      try {
        const sentMsg = await sock.sendMessage(GROUP_JID, {
          image: { url: image },
          caption: message,
          mimetype: 'image/jpeg'
        });
        // Auto-react to own message
        await autoReact(sentMsg.key);
        console.log(`📤 [IMG] ${source}: ${title.substring(0, 40)}... [${description.length} chars]`);
        return true;
      } catch (imgErr) {
        console.log(`⚠️ Image failed, using text...`);
      }
    }
    
    // Text fallback
    const sentMsg = await sock.sendMessage(GROUP_JID, { text: message });
    await autoReact(sentMsg.key);
    console.log(`📤 [TXT] ${source}: ${title.substring(0, 40)}... [${description.length} chars]`);
    return true;
  } catch (err) {
    return false;
  }
}

async function checkAndShareAllNewNews() {
  if (!isConnected || !sock || !sock.user) return;

  try {
    const allNews = await fetchAllLatestNews();
    if (allNews.length === 0) return;

    const state = loadState();
    let newArticlesSent = 0;

    for (const newsItem of allNews) {
      if (!newsItem.url) continue;
      if (state.sentUrls.includes(newsItem.url)) continue;

      const sent = await sendNewsToGroup(newsItem);
      if (sent) {
        state.sentUrls.push(newsItem.url);
        newArticlesSent++;
        saveState(state);
      }
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    console.log(newArticlesSent > 0 ? `✅ Sent ${newArticlesSent} new articles` : 'No new articles.');
  } catch (err) {
    console.error('Check failed:', err.message);
  }
}

(async () => {
  console.log('📰 News Bot by Charuka Mahesh');
  console.log('🙏 Thanks: Umesha Sathyanjali | Mithila Sharadha');
  
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  await ensureSingleInstance();
  await startWhatsAppBot();

  setInterval(() => checkAndShareAllNewNews(), CHECK_INTERVAL_MS);
})();
