// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║            🏏 Cricinfo Cricket News 🏏                      ║
// ╚══════════════════════════════════════════════════════════════╝

const axios = require('axios');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText } = require('./utils');

const FALLBACK_IMAGE = config.fallbackImage;

async function scrapeCricinfoArticle(url) {
    try {
        const res = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        const html = res.data;
        let description = '';
        let image = FALLBACK_IMAGE;
        
        // Get og:description
        const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogDesc?.[1]) description = cleanNewsText(ogDesc[1]);
        
        // Get og:image
        const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogImg?.[1]) image = ogImg[1];
        
        // Get meta description as fallback
        if (!description || description.length < 50) {
            const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
            if (metaDesc?.[1]) description = cleanNewsText(metaDesc[1]);
        }
        
        // Get paragraphs from article body
        if (!description || description.length < 50) {
            const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
            const text = paragraphs
                .map(p => p.replace(/<[^>]*>/g, '').trim())
                .filter(p => p.length > 30 && !p.includes('function') && !p.includes('Copyright') && !p.includes('ESPN'))
                .join(' ');
            if (text.length > 50) description = cleanNewsText(text);
        }
        
        return { description, image };
    } catch (e) {
        return { description: '', image: FALLBACK_IMAGE };
    }
}

async function fetchCricketNews() {
    const n = [];
    try {
        console.log('🏏 Fetching Cricinfo RSS...');
        
        const response = await axios.get('https://www.espncricinfo.com/rss/content/story/feeds/8.xml', {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            }
        });
        
        const xmlData = response.data;
        const items = xmlData.match(/<item>[\s\S]*?<\/item>/gi) || [];
        console.log(`🏏 RSS: ${items.length} items`);
        
        let count = 0;
        for (const item of items) {
            if (count >= 3) break;
            
            try {
                let title = '';
                const tm = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
                if (tm?.[1]) title = tm[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
                
                let url = '';
                const lm = item.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i);
                if (lm?.[1]) url = lm[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
                
                // Skip bad URLs
                if (!url || url === 'https://www.espncricinfo.com/' || 
                    url === 'https://www.cricinfo.com/' || !url.includes('/story/')) {
                    continue;
                }
                
                title = cleanNewsText(title);
                if (!title || title.length < 10) continue;
                
                // SCRAPE ARTICLE FOR FULL DESCRIPTION
                console.log(`🏏 Scraping: ${url}`);
                const articleData = await scrapeCricinfoArticle(url);
                
                let description = articleData.description;
                let image = articleData.image;
                
                if (!description || description.length < 30 || isGarbageDescription(description)) {
                    description = title;
                }
                
                n.push({
                    source: '🏏 Cricinfo',
                    category: 'Cricket',
                    title: title,
                    description: formatNewsText(fixLineBreaks(description), title),
                    url: url,
                    image: image,
                    date: ''
                });
                count++;
                console.log(`🏏 Added: ${title.substring(0, 50)}...`);
            } catch (e) {
                console.error('🏏 Item error:', e.message);
            }
            await new Promise(r => setTimeout(r, 800));
        }
    } catch (e) {
        console.error('❌ Cricket fetch error:', e.message);
    }
    
    console.log(`🏏 Cricket: ${n.length} articles`);
    return n;
}

module.exports = fetchCricketNews;