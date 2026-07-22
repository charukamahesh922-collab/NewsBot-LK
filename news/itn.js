// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                📺 ITN News 📺                                ║
// ╚══════════════════════════════════════════════════════════════╝

const DY_NEWS = require('@dark-yasiya/news-scrap');
const axios = require('axios');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText } = require('./utils');

const dynews = new DY_NEWS();
const FALLBACK_IMAGE = config.fallbackImage;

async function fetchItnNews() {
    const n = [];
    try {
        // First try the package
        try {
            const r = await dynews.itn();
            if (r?.status && r?.result) {
                const x = r.result;
                if (x.url && x.title && x.url !== 'undefined') {
                    let desc = cleanNewsText(x.desc || '');
                    if (isGarbageDescription(desc) || desc.length < 30) {
                        desc = x.title;
                    }
                    n.push({
                        source: '📺 ITN',
                        category: 'Latest',
                        title: cleanNewsText(x.title),
                        description: formatNewsText(fixLineBreaks(desc), x.title),
                        url: x.url,
                        image: x.image || FALLBACK_IMAGE,
                        date: `${x.date || ''} ${x.time || ''}`.trim() || ''
                    });
                }
            }
        } catch (packageError) {
            console.log('⚠️ ITN package failed, trying direct scrape...');
        }
        
        // If package failed, try direct scraping with better headers
        if (n.length === 0) {
            console.log('📺 ITN: Trying direct scrape...');
            
            const response = await axios.get('https://www.itnnews.lk/', {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'si,en-US;q=0.7,en;q=0.3',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                }
            });
            
            const html = response.data;
            if (!html || html.includes('Just a moment')) {
                console.log('❌ ITN: Cloudflare blocked');
                return n;
            }
            
            console.log(`✅ ITN: Got HTML (${html.length} bytes)`);
            
            const seenUrls = new Set();
            
            // Find article links
            const patterns = [
                /<a[^>]*href="(https:\/\/www\.itnnews\.lk\/[^"]*\/)"[^>]*>([\s\S]*?)<\/a>/gi,
                /<h[2-4][^>]*>\s*<a[^>]*href="(https:\/\/www\.itnnews\.lk\/[^"]*\/)"[^>]*>([\s\S]*?)<\/a>/gi,
            ];
            
            for (const pattern of patterns) {
                let match;
                while ((match = pattern.exec(html)) !== null && n.length < 1) {
                    const url = match[1];
                    let title = match[2].replace(/<[^>]*>/g, '').trim();
                    title = cleanNewsText(title);
                    
                    if (title && title.length > 20 && !seenUrls.has(url) && 
                        url !== 'https://www.itnnews.lk/' && !url.includes('#')) {
                        seenUrls.add(url);
                        
                        // Scrape article page
                        let desc = title;
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
                            if (ogDesc?.[1] && ogDesc[1].length > 30) {
                                desc = cleanNewsText(ogDesc[1]);
                            }
                            
                            const ogImg = articleHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
                            if (ogImg?.[1]) image = ogImg[1];
                            
                            if (!desc || desc.length < 50) {
                                const paragraphs = articleHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
                                const text = paragraphs
                                    .map(p => p.replace(/<[^>]*>/g, '').trim())
                                    .filter(p => p.length > 30 && !p.includes('function'))
                                    .join(' ');
                                if (text.length > 50) desc = cleanNewsText(text);
                            }
                        } catch (e) {}
                        
                        n.push({
                            source: '📺 ITN',
                            category: 'Latest',
                            title: title,
                            description: formatNewsText(fixLineBreaks(desc), title),
                            url: url,
                            image: image,
                            date: ''
                        });
                    }
                }
            }
        }
        
    } catch (e) {
        console.error('❌ ITN fetch error:', e.message);
    }
    
    console.log(`📺 ITN: ${n.length} articles`);
    return n;
}

module.exports = fetchItnNews;
