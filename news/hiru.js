// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🇱🇰 Hiru News 🇱🇰                           ║
// ╚══════════════════════════════════════════════════════════════╝

const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText, scrapeArticleWithImage } = require('./utils');

const FALLBACK_IMAGE = config.fallbackImage;

async function fetchHiruNews() {
    const n = [];
    try {
        const Hiru = require('hirunews-scrap');
        const a = new Hiru();
        const cats = ['BreakingNews', 'MainNews', 'TrendingNews'];
        const seenUrls = new Set();
        
        for (const c of cats) {
            if (typeof a[c] !== 'function') continue;
            try {
                const i = await a[c]();
                const u = i?.results?.newsURL;
                const t = i?.results?.title;
                
                if (u && !seenUrls.has(u) && t) {
                    seenUrls.add(u);
                    
                    let desc = i.results?.news || '';
                    let image = i.results?.thumb || '';
                    
                    // Try to get better description from article page
                    try {
                        const articleData = await scrapeArticleWithImage(u);
                        if (articleData.description && articleData.description.length > 50 && !isGarbageDescription(articleData.description)) {
                            desc = articleData.description;
                        }
                        if (articleData.image) image = articleData.image;
                    } catch (e) {}
                    
                    // CLEAN: Remove Hiru garbage text
                    desc = cleanNewsText(desc);
                    desc = desc
                        .replace(/Hiru News.*?Sri Lanka/gi, '')
                        .replace(/Most visited website.*?Sri Lankans/gi, '')
                        .replace(/Welcome to the No1.*?Site/gi, '')
                        .replace(/A Rayynor Silva Holdings Company/gi, '')
                        .replace(/Sri Lanka Latest news.*$/gi, '')
                        .replace(/Sri Lanka News updates.*$/gi, '')
                        .trim();
                    
                    if (isGarbageDescription(desc) || desc.length < 20) desc = t;
                    
                    n.push({
                        source: '🇱🇰 Hiru News',
                        category: c.replace('News', ''),
                        title: cleanNewsText(t),
                        description: formatNewsText(fixLineBreaks(desc), t),
                        url: u,
                        image: image || FALLBACK_IMAGE,
                        date: i.results?.date || ''
                    });
                }
            } catch (e) {}
        }
    } catch (e) {
        console.error('❌ Hiru fetch error:', e.message);
    }
    return n;
}

module.exports = fetchHiruNews;
