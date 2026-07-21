// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║              📰 Daily Mirror News 📰                         ║
// ╚══════════════════════════════════════════════════════════════╝

const DY_NEWS = require('@dark-yasiya/news-scrap');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText, scrapeArticleWithImage } = require('./utils');

const dynews = new DY_NEWS();
const FALLBACK_IMAGE = config.fallbackImage;

async function fetchDailyMirrorNews() {
    const n = [];
    try {
        const r = await dynews.dailymirror();
        if (r?.status && r?.result) {
            const x = r.result;
            if (x.url && x.title) {
                const { description, image } = await scrapeArticleWithImage(x.url);
                let desc = description || x.desc || '';
                if (isGarbageDescription(desc)) desc = x.title;
                n.push({
                    source: '📰 Daily Mirror',
                    category: 'Latest',
                    title: cleanNewsText(x.title),
                    description: formatNewsText(fixLineBreaks(desc), x.title),
                    url: x.url,
                    image: image || x.image || FALLBACK_IMAGE,
                    date: `${x.date || ''} ${x.time || ''}`.trim() || ''
                });
            }
        }
    } catch (e) {
        console.error('❌ Daily Mirror fetch error:', e.message);
    }
    return n;
}

module.exports = fetchDailyMirrorNews;