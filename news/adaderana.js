// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║               📰 AdaDerana RSS News 📰                      ║
// ╚══════════════════════════════════════════════════════════════╝

const axios = require('axios');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText, scrapeArticleWithImage } = require('./utils');

const FALLBACK_IMAGE = config.fallbackImage;

async function fetchAdaDeranaRSS() {
    const n = [];
    try {
        const r = await axios.get('https://www.adaderana.lk/rss.php', {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const items = r.data.match(/<item>([\s\S]*?)<\/item>/gi) || [];
        
        for (const i of items.slice(0, 5)) {
            let t = (i.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim() || '';
            const u = (i.match(/<link>([^<]+)<\/link>/i) || [])[1]?.trim() || '';
            let d = (i.match(/<description>([^<]+)<\/description>/i) || [])[1]?.trim() || '';
            
            t = cleanNewsText(t);
            d = cleanNewsText(d);
            
            // If description is same as title or garbage, scrape the article
            if (!d || d.length < 30 || d === t || isGarbageDescription(d) || 
                d.includes('LatestSportsBusiness') || d.includes('ENGLISH')) {
                if (u) {
                    try {
                        const ad = await scrapeArticleWithImage(u);
                        if (ad.description?.length > 30 && !isGarbageDescription(ad.description)) {
                            d = ad.description;
                        }
                    } catch (e) {}
                }
            }
            
            // If description matches title, try to get better one
            if (d === t || d.length < 10) {
                d = '📰 Click the link to read the full article';
            }
            
            if (t && u && t.length > 5 && !t.includes('Home') && !t.includes('About Us')) {
                n.push({
                    source: '📰 AdaDerana RSS',
                    category: 'Latest News',
                    title: t,
                    description: formatNewsText(fixLineBreaks(d), t),
                    url: u,
                    image: FALLBACK_IMAGE,
                    date: ''
                });
                await new Promise(r => setTimeout(r, 500));
            }
        }
    } catch (e) {
        console.error('❌ AdaDerana RSS error:', e.message);
    }
    return n;
}

module.exports = fetchAdaDeranaRSS;