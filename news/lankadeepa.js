// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║            📰 Lankadeepa News 📰                             ║
// ╚══════════════════════════════════════════════════════════════╝

const DY_NEWS = require('@dark-yasiya/news-scrap');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText, scrapeArticleWithImage } = require('./utils');

const dynews = new DY_NEWS();
const FALLBACK_IMAGE = config.fallbackImage;

async function fetchLankadeepaNews() {
    const n = [];
    try {
        const r = await dynews.lankadeepa();
        if (r?.status && r?.result) {
            const x = r.result;
            if (x.url && x.title) {
                const { description, image } = await scrapeArticleWithImage(x.url);
                let desc = description || x.desc || '';
                if (isGarbageDescription(desc)) desc = x.title;
                n.push({
                    source: '📰 Lankadeepa',
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
        console.error('❌ Lankadeepa fetch error:', e.message);
    }
    return n;
}

module.exports = fetchLankadeepaNews;
