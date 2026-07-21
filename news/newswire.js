// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                 📰 Newswire News 📰                         ║
// ╚══════════════════════════════════════════════════════════════╝

const DY_NEWS = require('@dark-yasiya/news-scrap');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText, scrapeArticleWithImage } = require('./utils');

const dynews = new DY_NEWS();
const FALLBACK_IMAGE = config.fallbackImage;

async function fetchNewswireNews() {
    const n = [];
    try {
        const r = await dynews.newswire();
        if (r?.status && r?.result) {
            const x = r.result;
            if (x.url && x.title) {
                let d = cleanNewsText(x.desc || '');
                if (isGarbageDescription(d) || d.length < 30) {
                    try {
                        const ad = await scrapeArticleWithImage(x.url);
                        if (ad.description?.length > 30 && !isGarbageDescription(ad.description)) d = ad.description;
                    } catch (e) {}
                }
                if (isGarbageDescription(d)) d = x.title;
                n.push({
                    source: '📰 Newswire',
                    category: 'Latest',
                    title: cleanNewsText(x.title),
                    description: formatNewsText(fixLineBreaks(d), x.title),
                    url: x.url,
                    image: x.image || FALLBACK_IMAGE,
                    date: `${x.date || ''} ${x.time || ''}`.trim() || ''
                });
            }
        }
    } catch (e) {
        console.error('❌ Newswire fetch error:', e.message);
    }
    return n;
}

module.exports = fetchNewswireNews;
