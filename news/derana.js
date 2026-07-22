// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🔴 Ada Derana News 🔴                      ║
// ╚══════════════════════════════════════════════════════════════╝

const Derana = require('ada-derana-news-scraper');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText, scrapeArticleWithImage } = require('./utils');

const FALLBACK_IMAGE = config.fallbackImage;

async function fetchDeranaNews() {
    const n = [];
    try {
        const r = await Derana.scrapeHotNews();
        if (Array.isArray(r)) {
            for (const a of r.slice(0, 3)) {
                const u = a.url || '', t = a.title || '';
                if (u && t) {
                    const { description, image } = await scrapeArticleWithImage(u);
                    let desc = description || a.content || a.description || '';
                    if (isGarbageDescription(desc)) desc = t;
                    n.push({
                        source: '🔴 Ada Derana',
                        category: 'Hot News',
                        title: cleanNewsText(t),
                        description: formatNewsText(fixLineBreaks(desc), t),
                        url: u,
                        image: image || FALLBACK_IMAGE,
                        date: a.time || ''
                    });
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }
    } catch (e) {
        console.error('❌ Derana fetch error:', e.message);
    }
    return n;
}

module.exports = fetchDeranaNews;
