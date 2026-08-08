// commands/downloader.js

const axios = require('axios');

const react = async (sock, jid, key, emoji) => {
    try { await sock.sendMessage(jid, { react: { text: emoji, key } }); } catch {}
};

const footer = function() { return '🦄💝 NewsBot LK | Charuka Mahesh'; };

let nayan = null;
let yts = null;
try { nayan = require('nayan-media-downloaders'); } catch (e) {}
try { yts = require('yt-search'); } catch (e) {}

async function handleDownloaderCommands(sock, msg, jid, text, lower, sender, db) {
    
    // YouTube Search & Download
    if (lower.startsWith('.yt ') || lower.startsWith('yt ')) {
        const input = text.replace(/^\.?yt\s+/, '').trim();
        if (!input) { await sock.sendMessage(jid, { text: '💡 .yt <url or search>\n\n🎬 .yt superman theme\n🔗 .yt https://youtube.com/watch?v=xxx' }); return; }
        
        const s = await sock.sendMessage(jid, { text: '🔍 Searching YouTube...' });
        await react(sock, jid, s.key, '🔍');
        
        try {
            const isUrl = input.includes('youtube.com') || input.includes('youtu.be');
            
            if (isUrl && nayan) {
                await sock.sendMessage(jid, { text: '📥 Downloading...' });
                let r = null;
                try { r = await nayan.ndown(input); } catch (e) {}
                if (!r || !r.status) { try { r = await nayan.ytdown(input); } catch (e) {} }
                
                if (r && r.status && r.data) {
                    const d = r.data;
                    const vUrl = d.video || (Array.isArray(d) && d[0]?.url) || d.url;
                    const title = d.title || 'YouTube';
                    if (vUrl) {
                        const sent = await sock.sendMessage(jid, { 
                            video: { url: vUrl }, 
                            caption: '🎬 ' + title + '\n\n✅ Downloaded!\n' + footer(), 
                            mimetype: 'video/mp4' 
                        });
                        await react(sock, jid, sent.key, '💝');
                        return;
                    }
                }
            }
            
            if (yts) {
                const r = await yts(input);
                const vids = r.videos;
                if (vids && vids.length > 0) {
                    let txt = '🎬 *' + input + '*\n\n';
                    vids.slice(0, 5).forEach(function(v, i) {
                        const n = ['①','②','③','④','⑤'][i];
                        txt += n + ' ' + v.title + '\n';
                        txt += '  👤 ' + (v.author?.name || '??') + '  ⏱ ' + (v.duration?.timestamp || '?') + '  👁 ' + (v.views ? (v.views/1000000).toFixed(1) + 'M' : '0') + '\n\n';
                    });
                    txt += '💡 .yt 1 to download\n' + footer();
                    const sent = await sock.sendMessage(jid, { text: txt });
                    await react(sock, jid, sent.key, '✅');
                    return;
                }
            }
            await sock.sendMessage(jid, { text: '❌ No results 😔' });
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ Failed! Try again 😔' });
        }
        return;
    }

    // YouTube MP3
    if (lower.startsWith('.ytmp3 ') || lower.startsWith('ytmp3 ')) {
        const input = text.replace(/^\.?ytmp3\s+/, '').trim();
        if (!input) { await sock.sendMessage(jid, { text: '💡 .ytmp3 <url>' }); return; }
        
        const s = await sock.sendMessage(jid, { text: '🎵 Extracting audio...' });
        await react(sock, jid, s.key, '🎵');
        
        try {
            if (!nayan) throw new Error('Not installed');
            let r = null;
            try { r = await nayan.ndown(input); } catch (e) {}
            if (!r || !r.status) { try { r = await nayan.ytdown(input); } catch (e) {} }
            
            if (r && r.status && r.data) {
                const d = r.data;
                const aUrl = d.audio || (Array.isArray(d) && d[0]?.url);
                const title = d.title || 'Audio';
                if (aUrl) {
                    const sent = await sock.sendMessage(jid, { audio: { url: aUrl }, mimetype: 'audio/mp4', ptt: false });
                    await react(sock, jid, sent.key, '🎵');
                    await sock.sendMessage(jid, { text: '🎵 ' + title + '\n\n✅ Done!\n' + footer() });
                    return;
                }
            }
            await sock.sendMessage(jid, { text: '❌ Failed 😔' });
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ Failed! 😔' });
        }
        return;
    }

    // YouTube MP4
    if (lower.startsWith('.ytmp4 ') || lower.startsWith('ytmp4 ')) {
        const input = text.replace(/^\.?ytmp4\s+/, '').trim();
        if (!input) { await sock.sendMessage(jid, { text: '💡 .ytmp4 <url>' }); return; }
        
        const s = await sock.sendMessage(jid, { text: '📥 Downloading...' });
        await react(sock, jid, s.key, '📥');
        
        try {
            if (!nayan) throw new Error('Not installed');
            let r = null;
            try { r = await nayan.ndown(input); } catch (e) {}
            if (!r || !r.status) { try { r = await nayan.ytdown(input); } catch (e) {} }
            
            if (r && r.status && r.data) {
                const d = r.data;
                const vUrl = d.video || (Array.isArray(d) && d[0]?.url);
                const title = d.title || 'Video';
                if (vUrl) {
                    const sent = await sock.sendMessage(jid, { 
                        video: { url: vUrl }, 
                        caption: '🎬 ' + title + '\n\n✅ MP4 Ready!\n' + footer(), 
                        mimetype: 'video/mp4' 
                    });
                    await react(sock, jid, sent.key, '💝');
                    return;
                }
            }
            await sock.sendMessage(jid, { text: '❌ No video 😔' });
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ Failed! 😔' });
        }
        return;
    }

    // Instagram
    if (lower.startsWith('.ig ') || lower.startsWith('ig ')) {
        const url = text.replace(/^\.?ig\s+/, '').trim();
        if (!url) { await sock.sendMessage(jid, { text: '💡 .ig <url>' }); return; }
        
        const s = await sock.sendMessage(jid, { text: '📸 Downloading...' });
        await react(sock, jid, s.key, '📸');
        
        try {
            if (!nayan) throw new Error('Not installed');
            const r = await nayan.instagram(url);
            if (r && r.status && r.data && r.data.length > 0) {
                const m = r.data[0];
                if (m.type === 'image') {
                    const sent = await sock.sendMessage(jid, { image: { url: m.url }, caption: '📸 Instagram\n\n✅ Done!\n' + footer() });
                    await react(sock, jid, sent.key, '❤️');
                } else {
                    const sent = await sock.sendMessage(jid, { video: { url: m.url }, caption: '🎬 Instagram\n\n✅ Done!\n' + footer() });
                    await react(sock, jid, sent.key, '💝');
                }
            } else {
                await sock.sendMessage(jid, { text: '❌ No media 😔' });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ Failed! 😔' });
        }
        return;
    }

    // Facebook
    if (lower.startsWith('.fb ') || lower.startsWith('fb ')) {
        const url = text.replace(/^\.?fb\s+/, '').trim();
        if (!url) { await sock.sendMessage(jid, { text: '💡 .fb <url>' }); return; }
        
        const s = await sock.sendMessage(jid, { text: '🎬 Downloading...' });
        await react(sock, jid, s.key, '🎬');
        
        try {
            if (!nayan) throw new Error('Not installed');
            let r = null;
            try { r = await nayan.ndown(url); } catch (e) {}
            if (!r || !r.status) { try { r = await nayan.facebook(url); } catch (e) {} }
            if (r && r.status && r.data) {
                const d = r.data;
                const vUrl = d.hd || d.sd || (Array.isArray(d) && d[0]?.url) || d.url;
                if (vUrl) {
                    const sent = await sock.sendMessage(jid, { video: { url: vUrl }, caption: '🎬 Facebook\n\n✅ Done!\n' + footer() });
                    await react(sock, jid, sent.key, '💝');
                    return;
                }
            }
            await sock.sendMessage(jid, { text: '❌ No video 😔' });
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ Failed! 😔' });
        }
        return;
    }

    // TikTok
    if (lower.startsWith('.tt ') || lower.startsWith('tt ')) {
        const url = text.replace(/^\.?tt\s+/, '').trim();
        if (!url) { await sock.sendMessage(jid, { text: '💡 .tt <url>' }); return; }
        
        const s = await sock.sendMessage(jid, { text: '🎵 Downloading...' });
        await react(sock, jid, s.key, '🎵');
        
        try {
            if (!nayan) throw new Error('Not installed');
            const r = await nayan.tikdown(url);
            if (r && r.status && r.data && r.data.video) {
                const title = r.data.title || 'TikTok';
                const author = r.data.author?.nickname || '';
                const sent = await sock.sendMessage(jid, { 
                    video: { url: r.data.video }, 
                    caption: '🎵 ' + title + '\n👤 @' + author + '\n🚫 No WM\n\n✅ Done!\n' + footer() 
                });
                await react(sock, jid, sent.key, '💝');
            } else {
                await sock.sendMessage(jid, { text: '❌ No video 😔' });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ Failed! 😔' });
        }
        return;
    }

    // Pinterest
    if (lower.startsWith('.pin ') || lower.startsWith('pin ')) {
        const url = text.replace(/^\.?pin\s+/, '').trim();
        if (!url) { await sock.sendMessage(jid, { text: '💡 .pin <url>' }); return; }
        
        const s = await sock.sendMessage(jid, { text: '📌 Downloading...' });
        await react(sock, jid, s.key, '📌');
        
        try {
            const r = await axios.get('https://api.giftedtech.my.id/api/download/pinterest?apikey=gifted&url=' + encodeURIComponent(url), { timeout: 30000 });
            if (r.data?.data?.media) {
                const sent = await sock.sendMessage(jid, { video: { url: r.data.data.media }, caption: '📌 Pinterest\n\n✅ Done!\n' + footer() });
                await react(sock, jid, sent.key, '💝');
            } else {
                await sock.sendMessage(jid, { text: '❌ No media 😔' });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ Failed! 😔' });
        }
        return;
    }

    // Google Search
    if (lower.startsWith('.google ') || lower.startsWith('google ')) {
        const query = text.replace(/^\.?google\s+/, '').trim();
        if (!query) { await sock.sendMessage(jid, { text: '💡 .google <search>' }); return; }
        
        const s = await sock.sendMessage(jid, { text: '🔍 Searching...' });
        await react(sock, jid, s.key, '🔍');
        
        try {
            const r = await axios.get('https://www.googleapis.com/customsearch/v1?q=' + encodeURIComponent(query) + '&key=AIzaSyDummyKey&cx=017576662512468239146:omuauf_lfve', { timeout: 10000 });
            const items = r.data?.items?.slice(0, 5) || [];
            if (items.length > 0) {
                let txt = '🔍 ' + query + '\n\n';
                items.forEach(function(v, i) {
                    txt += (i+1) + '. ' + v.title + '\n   🔗 ' + v.link + '\n   ' + (v.snippet || '').substring(0, 100) + '\n\n';
                });
                txt += '📊 ' + items.length + ' results\n' + footer();
                const sent = await sock.sendMessage(jid, { text: txt });
                await react(sock, jid, sent.key, '✅');
            } else {
                await sock.sendMessage(jid, { text: '❌ No results 😔\n🔗 https://www.google.com/search?q=' + encodeURIComponent(query) });
            }
        } catch (e) {
            await sock.sendMessage(jid, { text: '❌ Failed 😔\n🔗 https://www.google.com/search?q=' + encodeURIComponent(query) });
        }
        return;
    }
}

module.exports = { handleDownloaderCommands };
