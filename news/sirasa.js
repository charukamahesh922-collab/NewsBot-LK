// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  📺 Sirasa TV News 📺                       ║
// ╚══════════════════════════════════════════════════════════════╝

const DY_NEWS = require('@dark-yasiya/news-scrap');
const axios = require('axios');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText } = require('./utils');

const dynews = new DY_NEWS();
const FALLBACK_IMAGE = config.fallbackImage;

async function fetchSirasaNews() {
    const n = [];
    try {
        const r = await dynews.sirasa();
        if (r?.status && r?.result) {
            const x = r.result;
            if (x.url && x.title) {
                let desc = cleanNewsText(x.desc || '');
                let image = x.image || FALLBACK_IMAGE;
                
                // Clean Sirasa/Newsfirst garbage text
                desc = desc
                    .replace(/ශ්‍රී ලංකා ප්‍රවෘත්ති:.*$/g, '')
                    .replace(/Sri Lanka News:.*$/gi, '')
                    .replace(/ලොව පුරා නවතම.*$/g, '')
                    .replace(/සජීව ප්‍රවෘත්ති.*$/g, '')
                    .replace(/අප වෙබි අඩවියට.*$/g, '')
                    .replace(/පිවිසෙන්න.*$/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                // If description is too short or garbage after cleaning, try scraping
                if (!desc || desc.length < 50 || isGarbageDescription(desc)) {
                    try {
                        const articleRes = await axios.get(x.url, {
                            timeout: 10000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                            }
                        });
                        const html = articleRes.data;
                        
                        // Get og:description
                        const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
                        if (ogDesc?.[1] && ogDesc[1].length > 50) {
                            desc = cleanNewsText(ogDesc[1]);
                        }
                        
                        // Get paragraphs
                        if (!desc || desc.length < 50) {
                            const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
                            const text = paragraphs
                                .map(p => p.replace(/<[^>]*>/g, '').trim())
                                .filter(p => p.length > 30 && 
                                    !p.includes('ශ්‍රී ලංකා ප්‍රවෘත්ති') &&
                                    !p.includes('Sri Lanka News') &&
                                    !p.includes('function') && 
                                    !p.includes('Copyright'))
                                .join(' ');
                            if (text.length > 50) desc = cleanNewsText(text);
                        }
                        
                        // Get og:image
                        const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
                        if (ogImg?.[1]) image = ogImg[1];
                    } catch (e) {}
                }
                
                // Final cleanup
                desc = cleanNewsText(desc);
                desc = desc
                    .replace(/ශ්‍රී ලංකා ප්‍රවෘත්ති:.*$/g, '')
                    .replace(/Sri Lanka News:.*$/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                if (!desc || desc.length < 10 || isGarbageDescription(desc)) {
                    desc = cleanNewsText(x.title);
                }
                
                n.push({
                    source: '📺 Sirasa TV',
                    category: 'Latest',
                    title: cleanNewsText(x.title),
                    description: formatNewsText(fixLineBreaks(desc), x.title),
                    url: x.url,
                    image: image,
                    date: `${x.date || ''} ${x.time || ''}`.trim() || ''
                });
            }
        }
    } catch (e) {
        console.error('❌ Sirasa fetch error:', e.message);
    }
    return n;
}

module.exports = fetchSirasaNews;
