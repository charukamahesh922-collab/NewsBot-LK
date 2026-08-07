// commands/downloader.js

const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════
// 🎨 HELPERS
// ═══════════════════════════════════════════════════════

const react = async (sock, jid, key, emoji) => {
    try { await sock.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
};

const box = (title, lines) => [
    '╭' + '─'.repeat(38) + '╮',
    '┃  ' + title,
    '╰' + '─'.repeat(38) + '╯',
    '',
    ...lines,
    '',
    '🦄💝 *NewsBot LK* | Charuka Mahesh'
].join('\n');

const footer = () => '🦄💝 *NewsBot LK* | Charuka Mahesh';

// ═══════════════════════════════════════════════════════
// 📦 WORKING NPM PACKAGES
// ═══════════════════════════════════════════════════════
// npm install @xhubio/nayan-media-downloader
// npm install axios

let nayanDownloader = null;
try {
    nayanDownloader = require('@xhubio/nayan-media-downloader');
} catch (e) {
    console.log('⚠️ @xhubio/nayan-media-downloader not installed. Run: npm install @xhubio/nayan-media-downloader');
}

// ═══════════════════════════════════════════════════════
// ⬇️ DOWNLOAD FUNCTIONS
// ═══════════════════════════════════════════════════════

async function ytDownload(url) {
    if (!nayanDownloader) throw new Error('Downloader not installed');
    try {
        const result = await nayanDownloader.ytdown(url);
        return { video: result.data?.video, audio: result.data?.audio, title: result.data?.title };
    } catch (e) {
        throw new Error('YouTube download failed: ' + e.message);
    }
}

async function fbDownload(url) {
    if (!nayanDownloader) throw new Error('Downloader not installed');
    try {
        const result = await nayanDownloader.facebook(url);
        return { video: result.data?.hd || result.data?.sd, title: 'Facebook Video' };
    } catch (e) {
        throw new Error('Facebook download failed: ' + e.message);
    }
}

async function igDownload(url) {
    if (!nayanDownloader) throw new Error('Downloader not installed');
    try {
        const result = await nayanDownloader.instagram(url);
        const media = result.data?.[0];
        return { video: media?.url, thumbnail: media?.thumbnail, type: media?.type };
    } catch (e) {
        throw new Error('Instagram download failed: ' + e.message);
    }
}

async function ttDownload(url) {
    if (!nayanDownloader) throw new Error('Downloader not installed');
    try {
        const result = await nayanDownloader.tiktok(url);
        return { video: result.data?.play, title: result.data?.title, author: result.data?.author?.nickname };
    } catch (e) {
        throw new Error('TikTok download failed: ' + e.message);
    }
}

async function pinDownload(url) {
    try {
        const res = await axios.get(`https://api.giftedtech.my.id/api/download/pinterest?apikey=gifted&url=${encodeURIComponent(url)}`, { timeout: 30000 });
        if (res.data?.data?.media) return { video: res.data.data.media };
        throw new Error('No media found');
    } catch (e) {
        throw new Error('Pinterest download failed: ' + e.message);
    }
}

async function googleSearch(query) {
    try {
        const res = await axios.get(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=AIzaSyDummyKey&cx=017576662512468239146:omuauf_lfve`, { timeout: 10000 });
        return res.data?.items?.slice(0, 5) || [];
    } catch (e) {
        // Fallback to text response
        return [{ title: query, link: `https://www.google.com/search?q=${encodeURIComponent(query)}`, snippet: 'Search results on Google' }];
    }
}

// ═══════════════════════════════════════════════════════
// ⬇️ DOWNLOADER COMMANDS HANDLER
// ═══════════════════════════════════════════════════════

async function handleDownloaderCommands(sock, msg, jid, text, lower, sender, db) {
    
    // YouTube Video
    if (lower.startsWith('.yt ') || lower.startsWith('yt ')) {
        const url = text.replace(/^\.?yt\s+/, '').trim();
        if (!url) { await sock.sendMessage(jid, { text: '💡 *.yt <youtube_url>*' }); return; }
        
        await sock.sendMessage(jid, { text: '⏳ *Downloading YouTube video...*' });
        
        try {
            const result = await ytDownload(url);
            if (result.video) {
                const sent = await sock.sendMessage(jid, {
                    video: { url: result.video },
                    caption: `🎬 *${result.title || 'YouTube Video'}*\n\n${footer()}`
                });
                await react(sock, jid, sent.key, '✅');
            } else {
                await sock.sendMessage(jid, { text: '❌ *No video found!*' });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ *Failed!*\n' + e.message });
        }
        return;
    }

    // YouTube MP3
    if (lower.startsWith('.ytmp3 ') || lower.startsWith('ytmp3 ')) {
        const url = text.replace(/^\.?ytmp3\s+/, '').trim();
        if (!url) { await sock.sendMessage(jid, { text: '💡 *.ytmp3 <youtube_url>*' }); return; }
        
        await sock.sendMessage(jid, { text: '⏳ *Extracting audio...*' });
        
        try {
            const result = await ytDownload(url);
            if (result.audio) {
                const sent = await sock.sendMessage(jid, {
                    audio: { url: result.audio },
                    mimetype: 'audio/mp4',
                    ptt: false
                });
                await react(sock, jid, sent.key, '✅');
                await sock.sendMessage(jid, { text: `🎵 *${result.title || 'Audio'}*\n\n${footer()}` });
            } else {
                await sock.sendMessage(jid, { text: '❌ *No audio found!*' });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ *Failed!*\n' + e.message });
        }
        return;
    }

    // YouTube MP4
    if (lower.startsWith('.ytmp4 ') || lower.startsWith('ytmp4 ')) {
        const url = text.replace(/^\.?ytmp4\s+/, '').trim();
        if (!url) { await sock.sendMessage(jid, { text: '💡 *.ytmp4 <youtube_url>*' }); return; }
        
        await sock.sendMessage(jid, { text: '⏳ *Downloading YouTube video...*' });
        
        try {
            const result = await ytDownload(url);
            if (result.video) {
                const sent = await sock.sendMessage(jid, {
                    video: { url: result.video },
                    caption: `🎬 *${result.title || 'YouTube Video'}*\n\n${footer()}`
                });
                await react(sock, jid, sent.key, '✅');
            } else {
                await sock.sendMessage(jid, { text: '❌ *No video found!*' });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ *Failed!*\n' + e.message });
        }
        return;
    }

    // Instagram
    if (lower.startsWith('.ig ') || lower.startsWith('ig ')) {
        const url = text.replace(/^\.?ig\s+/, '').trim();
        if (!url) { await sock.sendMessage(jid, { text: '💡 *.ig <instagram_url>*' }); return; }
        
        await sock.sendMessage(jid, { text: '⏳ *Downloading Instagram media...*' });
        
        try {
            const result = await igDownload(url);
            if (result.video) {
                if (result.type === 'image') {
                    const sent = await sock.sendMessage(jid, {
                        image: { url: result.video },
                        caption: `📸 *Instagram Post*\n\n${footer()}`
                    });
                    await react(sock, jid, sent.key, '✅');
                } else {
                    const sent = await sock.sendMessage(jid, {
                        video: { url: result.video },
                        caption: `🎬 *Instagram Reel*\n\n${footer()}`
                    });
                    await react(sock, jid, sent.key, '✅');
                }
            } else {
                await sock.sendMessage(jid, { text: '❌ *No media found!*' });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ *Failed!*\n' + e.message });
        }
        return;
    }

    // Facebook
    if (lower.startsWith('.fb ') || lower.startsWith('fb ')) {
        const url = text.replace(/^\.?fb\s+/, '').trim();
        if (!url) { await sock.sendMessage(jid, { text: '💡 *.fb <facebook_url>*' }); return; }
        
        await sock.sendMessage(jid, { text: '⏳ *Downloading Facebook video...*' });
        
        try {
            const result = await fbDownload(url);
            if (result.video) {
                const sent = await sock.sendMessage(jid, {
                    video: { url: result.video },
                    caption: `🎬 *Facebook Video*\n\n${footer()}`
                });
                await react(sock, jid, sent.key, '✅');
            } else {
                await sock.sendMessage(jid, { text: '❌ *No video found!*' });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ *Failed!*\n' + e.message });
        }
        return;
    }

    // TikTok
    if (lower.startsWith('.tt ') || lower.startsWith('tt ')) {
        const url = text.replace(/^\.?tt\s+/, '').trim();
        if (!url) { await sock.sendMessage(jid, { text: '💡 *.tt <tiktok_url>*' }); return; }
        
        await sock.sendMessage(jid, { text: '⏳ *Downloading TikTok video...*' });
        
        try {
            const result = await ttDownload(url);
            if (result.video) {
                const sent = await sock.sendMessage(jid, {
                    video: { url: result.video },
                    caption: `🎬 *${result.title || 'TikTok'}*\n👤 ${result.author || ''}\n\n${footer()}`
                });
                await react(sock, jid, sent.key, '✅');
            } else {
                await sock.sendMessage(jid, { text: '❌ *No video found!*' });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ *Failed!*\n' + e.message });
        }
        return;
    }

    // Pinterest
    if (lower.startsWith('.pin ') || lower.startsWith('pin ')) {
        const url = text.replace(/^\.?pin\s+/, '').trim();
        if (!url) { await sock.sendMessage(jid, { text: '💡 *.pin <pinterest_url>*' }); return; }
        
        await sock.sendMessage(jid, { text: '⏳ *Downloading Pinterest media...*' });
        
        try {
            const result = await pinDownload(url);
            if (result.video) {
                const sent = await sock.sendMessage(jid, {
                    video: { url: result.video },
                    caption: `📌 *Pinterest*\n\n${footer()}`
                });
                await react(sock, jid, sent.key, '✅');
            } else {
                await sock.sendMessage(jid, { text: '❌ *No media found!*' });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ *Failed!*\n' + e.message });
        }
        return;
    }

    // Google Search
    if (lower.startsWith('.google ') || lower.startsWith('google ')) {
        const query = text.replace(/^\.?google\s+/, '').trim();
        if (!query) { await sock.sendMessage(jid, { text: '💡 *.google <search_query>*' }); return; }
        
        await sock.sendMessage(jid, { text: '🔍 *Searching...*' });
        
        try {
            const results = await googleSearch(query);
            if (results.length > 0) {
                const lines = results.map((r, i) => `  ${i + 1}. *${r.title}*\n  🔗 ${r.link}\n  📝 ${(r.snippet || '').substring(0, 100)}`).join('\n\n');
                const sent = await sock.sendMessage(jid, {
                    text: box(`🔍 *GOOGLE: ${query}*`, [lines, '', `  📊 Found ${results.length} results`])
                });
                await react(sock, jid, sent.key, '🔍');
            } else {
                await sock.sendMessage(jid, { text: '❌ *No results found!*' });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ *Search failed!*\n' + e.message });
        }
        return;
    }
}

module.exports = { handleDownloaderCommands };
