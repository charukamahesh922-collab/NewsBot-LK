// commands/tiktokAuto.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '..', 'tiktok_history.json');
const RAPIDAPI_KEY = '0e3e8df5e5msh630dab4a439df23p11a97bjsn0a98dde66b64';
const RAPIDAPI_HOST = 'tiktok-video-no-watermark2.p.rapidapi.com';

// ─── SINHALA KEYWORDS ──────────────────────────────────────
const SINHALA_KEYWORDS = [
  'sinhala status',
  'sinhala whatsapp status',
  'sinhala love status',
  'sinhala sad status',
  'sinhala happy status',
  'sinhala motivational',
  'sinhala song status',
  'sinhala dance status',
  'sinhala funny status',
  'sinhala emotional status',
  'sinhala life status',
  'sinhala beautiful status',
  'sinhala heart status',
  'sinhala couple status',
  'sinhala friendship status',
  'sinhala family status',
  'sinhala nature status',
  'sinhala travel status',
  'sinhala food status',
  'sinhala art status'
];

// ─── HISTORY MANAGEMENT ────────────────────────────────────
function getHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveHistory(history) {
  try {
    const trimmed = history.slice(-200);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2));
  } catch (e) {}
}

// ─── MAIN AUTO FUNCTION ────────────────────────────────────
function initTikTokAuto(sock, groupJid, intervalMinutes = 5) {
  if (!sock || !groupJid) {
    console.log('❌ TikTok Auto: Missing sock or groupJid');
    return;
  }

  console.log('\n🎬 TikTok Auto-Status Started');
  console.log(`📱 Target Group: ${groupJid}`);
  console.log(`⏰ Interval: Every ${intervalMinutes} minutes\n`);

  setTimeout(() => {
    checkAndSend(sock, groupJid);
  }, 15000);

  setInterval(() => {
    checkAndSend(sock, groupJid);
  }, intervalMinutes * 60 * 1000);
}

// ─── CHECK AND SEND ────────────────────────────────────────
async function checkAndSend(sock, groupJid) {
  try {
    const time = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const keyword = SINHALA_KEYWORDS[Math.floor(Math.random() * SINHALA_KEYWORDS.length)];
    console.log(`🎬 [${time}] Searching: "${keyword}"...`);

    let videos = await tryRapidAPI(keyword);
    
    if (!videos || videos.length === 0) {
      console.log('  🔄 Trying tikwm fallback...');
      videos = await tryTikWM(keyword);
    }

    if (!videos || videos.length === 0) {
      console.log('  📭 No videos found for:', keyword);
      return;
    }

    console.log(`  📱 Found ${videos.length} videos`);

    const history = getHistory();
    let sent = false;

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      
      if (history.includes(video.video_id)) {
        continue;
      }

      if (!video.play || !video.play.startsWith('http')) {
        console.log(`  ⚠️ Invalid URL for video ${video.video_id}`);
        continue;
      }

      try {
        // ─── ONLY SEND AUTHOR + POWERED BY ──────────────────
        const caption = `👤 @${video.author || 'tiktok'}\n\n⚡ Powered by Charuka Mahesh 💝`;

        await sock.sendMessage(groupJid, {
          video: { url: video.play },
          caption: caption,
          mimetype: 'video/mp4'
        });

        history.push(video.video_id);
        sent = true;
        console.log(`  ✅ SENT: @${video.author || 'tiktok'} | Total: ${history.length}`);
        break;

      } catch (error) {
        console.log(`  ⚠️ Send failed for ${video.video_id}: ${error.message}`);
        history.push(video.video_id);
      }
    }

    if (sent) {
      saveHistory(history);
    } else {
      console.log(`  ℹ️ All ${videos.length} videos checked, none sent`);
    }

  } catch (error) {
    console.error('❌ TikTok Auto error:', error.message);
  }
}

// ─── RAPIDAPI FETCHER ──────────────────────────────────────
async function tryRapidAPI(keyword) {
  try {
    const url = `https://tiktok-video-no-watermark2.p.rapidapi.com/feed/search?keywords=${encodeURIComponent(keyword)}&count=10&cursor=0`;

    const response = await axios.get(url, {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      },
      timeout: 15000
    });

    if (response.data?.data?.videos && response.data.data.videos.length > 0) {
      console.log(`  ✅ RapidAPI: ${response.data.data.videos.length} videos`);
      
      return response.data.data.videos.map((v) => ({
        video_id: v.video_id || v.id,
        play: v.play || v.download_url || v.url,
        title: v.title || v.description || '',
        duration: v.duration || 0,
        author: v.author?.unique_id || 'tiktok'
      }));
    }
  } catch (error) {
    console.log(`  ❌ RapidAPI: ${error.response?.status || error.message || 'error'}`);
  }
  return null;
}

// ─── TIKWM FALLBACK FETCHER ──────────────────────────────
async function tryTikWM(keyword) {
  try {
    const url = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(keyword)}&count=10`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    if (response.data?.data?.videos && response.data.data.videos.length > 0) {
      console.log(`  ✅ tikwm: ${response.data.data.videos.length} videos`);
      
      return response.data.data.videos.map((v) => ({
        video_id: v.video_id,
        play: v.play?.startsWith('http') ? v.play : `https://www.tikwm.com${v.play}`,
        title: v.title || '',
        duration: v.duration || 0,
        author: v.author?.unique_id || 'tiktok'
      }));
    }
  } catch (error) {
    console.log(`  ❌ tikwm: ${error.message.substring(0, 40)}`);
  }
  return null;
}

// ─── EXPORTS ─────────────────────────────────────────────────
module.exports = { initTikTokAuto, checkAndSend };
