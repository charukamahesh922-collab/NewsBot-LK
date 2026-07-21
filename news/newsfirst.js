// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║              📺 Newsfirst Sinhala News 📺                    ║
// ╚══════════════════════════════════════════════════════════════╝

const axios = require('axios');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText } = require('./utils');

const FALLBACK_IMAGE = config.fallbackImage;

async function scrapeNewsfirstArticle(url) {
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
        
        // og:description
        const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogDesc?.[1]) description = cleanNewsText(ogDesc[1]);
        
        // og:image
        const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogImg?.[1]) image = ogImg[1];
        
        // Article content
        if (!description || description.length < 50) {
            const contentDiv = html.match(/<div[^>]*class="[^"]*(?:entry-content|article-content|td-post-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                              html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
            const textHtml = contentDiv ? contentDiv[1] : html;
            const paragraphs = textHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
            const text = paragraphs
                .map(p => p.replace(/<[^>]*>/g, '').trim())
                .filter(p => p.length > 30 && !p.includes('function') && !p.includes('Copyright'))
                .join(' ');
            if (text.length > 50) description = cleanNewsText(text);
        }
        
        // Clean site taglines
        description = description
            .replace(/ශ්‍රී ලංකා ප්‍රවෘත්ති[\s\S]*$/g, '')
            .replace(/Sri Lanka News[\s\S]*$/gi, '')
            .replace(/ලොව පුරා නවතම[\s\S]*$/g, '')
            .trim();
        
        return { description, image };
    } catch (e) { return { description: '', image: FALLBACK_IMAGE }; }
}

async function fetchNewsfirstNews() {
    const n = [];
    try {
        console.log('📺 Fetching Newsfirst Sinhala news...');
        
        const response = await axios.get('https://sinhala.newsfirst.lk/', {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'si,en-US;q=0.7,en;q=0.3'
            }
        });
        
        const html = response.data;
        if (!html) { console.log('❌ Newsfirst: No HTML'); return n; }
        
        console.log(`✅ Newsfirst: Got HTML (${html.length} bytes)`);
        
        const seenUrls = new Set();
        
        // Find article links
        const patterns = [
            /<a[^>]*href="(https:\/\/sinhala\.newsfirst\.lk\/\d+\/\d+\/[^"]*\/)"[^>]*>([\s\S]*?)<\/a>/gi,
            /<h[2-4][^>]*>\s*<a[^>]*href="(https:\/\/sinhala\.newsfirst\.lk\/[^"]*\/)"[^>]*>([\s\S]*?)<\/a>/gi,
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(html)) !== null && n.length < 2) {
                const url = match[1];
                let title = match[2].replace(/<[^>]*>/g, '').trim();
                title = cleanNewsText(title);
                
                if (title && title.length > 20 && !seenUrls.has(url) && 
                    !url.endsWith('/newsfirst.lk/')) {
                    seenUrls.add(url);
                    
                    const articleData = await scrapeNewsfirstArticle(url);
                    let desc = articleData.description || title;
                    if (!desc || desc.length < 30) desc = title;
                    
                    n.push({
                        source: '📺 Newsfirst',
                        category: 'Latest News',
                        title: title,
                        description: formatNewsText(fixLineBreaks(desc), title),
                        url: url,
                        image: articleData.image,
                        date: ''
                    });
                    console.log(`📺 Newsfirst: ${title.substring(0, 50)}...`);
                }
            }
        }
        
    } catch (e) {
        console.error('❌ Newsfirst fetch error:', e.message);
    }
    
    console.log(`📺 Newsfirst: ${n.length} articles`);
    return n;
}

module.exports = fetchNewsfirstNews;