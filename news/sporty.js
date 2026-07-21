// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║            🏏 Sporty.lk Sinhala Cricket News 🏏              ║
// ╚══════════════════════════════════════════════════════════════╝

const axios = require('axios');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText } = require('./utils');

const FALLBACK_IMAGE = config.fallbackImage;

async function fetchSportyNews() {
    const n = [];
    try {
        console.log('🏏 Fetching Sporty.lk cricket news...');
        
        // Try multiple Sporty.lk URLs
        const urls = [
            'https://sporty.lk/',
            'https://sporty.lk/category/cricket/',
            'https://sporty.lk/si/',
        ];
        
        let html = null;
        for (const url of urls) {
            try {
                const response = await axios.get(url, {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    }
                });
                if (response.data && response.data.length > 5000) {
                    html = response.data;
                    console.log(`✅ Sporty.lk: Got HTML from ${url} (${html.length} bytes)`);
                    break;
                }
            } catch (e) {
                console.log(`⚠️ Sporty.lk ${url}: ${e.message}`);
            }
        }
        
        if (!html) {
            console.log('❌ Sporty.lk: No HTML from any URL');
            return n;
        }
        
        const seenUrls = new Set();
        
        // Find article links with titles
        const patterns = [
            /<h[2-4][^>]*class="[^"]*(?:post-title|entry-title|title)[^"]*"[^>]*>\s*<a[^>]*href="(https:\/\/sporty\.lk\/[^"]*\/)"[^>]*>([\s\S]*?)<\/a>/gi,
            /<h[2-4][^>]*>\s*<a[^>]*href="(https:\/\/sporty\.lk\/(?!author\/|category\/|tag\/|si\/)[^"]*\/)"[^>]*>([\s\S]*?)<\/a>/gi,
            /<a[^>]*href="(https:\/\/sporty\.lk\/[^"]*\/)"[^>]*>([\s\S]*?)<\/a>/gi,
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(html)) !== null && n.length < 2) {
                let url = match[1];
                let title = match[2].replace(/<[^>]*>/g, '').trim();
                title = cleanNewsText(title);
                
                // Skip non-article URLs
                if (url.includes('/author/') || url.includes('/category/') || 
                    url.includes('/tag/') || url === 'https://sporty.lk/' ||
                    url === 'https://sporty.lk/si/') {
                    continue;
                }
                
                // Skip taglines
                if (title && title.length > 15 && !seenUrls.has(url) &&
                    !title.includes('sporty.lk is your go-to') &&
                    !title.includes('ශ්‍රී ලංකාවේ නවතම') &&
                    !title.includes('go-to platform')) {
                    seenUrls.add(url);
                    
                    let description = title;
                    let image = FALLBACK_IMAGE;
                    
                    try {
                        const articleRes = await axios.get(url, {
                            timeout: 10000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                            }
                        });
                        const articleHtml = articleRes.data;
                        
                        const ogDesc = articleHtml.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
                        if (ogDesc?.[1] && ogDesc[1].length > 50 && 
                            !ogDesc[1].includes('sporty.lk is your go-to') &&
                            !ogDesc[1].includes('ශ්‍රී ලංකාවේ නවතම')) {
                            description = cleanNewsText(ogDesc[1]);
                        }
                        
                        const ogImg = articleHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
                        if (ogImg?.[1]) image = ogImg[1];
                        
                        if (!description || description.length < 50) {
                            const paragraphs = articleHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
                            const text = paragraphs
                                .map(p => p.replace(/<[^>]*>/g, '').trim())
                                .filter(p => p.length > 30 && 
                                    !p.includes('sporty.lk is your go-to') &&
                                    !p.includes('Copyright'))
                                .join(' ');
                            if (text.length > 50) description = cleanNewsText(text);
                        }
                    } catch (e) {}
                    
                    if (!description || description.length < 20 || 
                        description.includes('sporty.lk is your go-to')) {
                        description = title;
                    }
                    
                    n.push({
                        source: '🏏 Sporty.lk',
                        category: 'Cricket',
                        title: title,
                        description: formatNewsText(fixLineBreaks(description), title),
                        url: url,
                        image: image,
                        date: ''
                    });
                    
                    console.log(`🏏 Sporty.lk: ${title.substring(0, 50)}...`);
                }
            }
        }
        
    } catch (e) {
        console.error('❌ Sporty.lk fetch error:', e.message);
    }
    
    console.log(`🏏 Sporty.lk: ${n.length} articles`);
    return n;
}

module.exports = fetchSportyNews;