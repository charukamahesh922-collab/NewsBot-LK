// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🌍 BBC Sinhala News 🌍                     ║
// ╚══════════════════════════════════════════════════════════════╝

const axios = require('axios');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText } = require('./utils');

const FALLBACK_IMAGE = config.fallbackImage;

async function fetchBBCSinhalaNews() {
    const n = [];
    try {
        console.log('📰 Fetching BBC Sinhala news via RSS...');
        
        // Try multiple RSS feed URLs
        const rssUrls = [
            'https://feeds.bbci.co.uk/sinhala/rss.xml',
            'https://www.bbc.com/sinhala/index.xml',
        ];
        
        let rssData = null;
        
        for (const rssUrl of rssUrls) {
            try {
                const response = await axios.get(rssUrl, {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                        'Accept-Language': 'si,en-US;q=0.7,en;q=0.3',
                    }
                });
                if (response.data && response.data.includes('<item>')) {
                    rssData = response.data;
                    console.log(`✅ BBC RSS: Got data from ${rssUrl}`);
                    break;
                }
            } catch (e) {
                console.log(`⚠️ BBC RSS ${rssUrl}: ${e.message}`);
            }
        }
        
        if (!rssData) {
            // Try direct BBC Sinhala page with different approach
            console.log('📰 BBC: Trying direct page...');
            try {
                const response = await axios.get('https://www.bbc.com/sinhala', {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'si,en-US;q=0.7,en;q=0.3',
                        'Referer': 'https://www.google.com/',
                        'Origin': 'https://www.bbc.com',
                    }
                });
                
                const html = response.data;
                if (html) {
                    console.log(`✅ BBC HTML: ${html.length} bytes`);
                    
                    // Find article links with titles
                    const articles = [];
                    const seen = new Set();
                    
                    // Pattern: Find article URLs
                    const urlMatches = html.match(/\/sinhala\/articles\/[a-z0-9]+/gi) || [];
                    
                    for (const path of [...new Set(urlMatches)].slice(0, 10)) {
                        const url = 'https://www.bbc.com' + path;
                        if (seen.has(url)) continue;
                        seen.add(url);
                        
                        // Try to find title near this URL in the HTML
                        const urlIndex = html.indexOf(path);
                        if (urlIndex > 0) {
                            const chunk = html.substring(Math.max(0, urlIndex - 500), Math.min(html.length, urlIndex + 500));
                            
                            // Try to find heading
                            let title = '';
                            const hMatch = chunk.match(/<h[2-4][^>]*>([^<]{10,200})<\/h[2-4]>/i);
                            if (hMatch?.[1]) title = cleanNewsText(hMatch[1]);
                            
                            if (!title) {
                                const spanMatch = chunk.match(/<span[^>]*>([^<]{15,200})<\/span>/i);
                                if (spanMatch?.[1]) title = cleanNewsText(spanMatch[1]);
                            }
                            
                            if (title && title.length > 15 && title.length < 200 &&
                                !title.includes('Skip') && !title.includes('navigation') &&
                                !title.includes('Cookies') && !title.includes('Privacy') &&
                                !title.includes('BBC News සිංහල')) {
                                articles.push({ url, title });
                            }
                        }
                    }
                    
                    console.log(`📰 BBC: Found ${articles.length} articles with titles`);
                    
                    for (const article of articles.slice(0, 5)) {
                        let desc = article.title;
                        let image = FALLBACK_IMAGE;
                        
                        // Try to get description from article page
                        try {
                            const articleRes = await axios.get(article.url, {
                                timeout: 10000,
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                                }
                            });
                            const articleHtml = articleRes.data;
                            
                            // Get image
                            const ogImg = articleHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
                            if (ogImg?.[1]) image = ogImg[1];
                            
                            // Get paragraphs
                            const paragraphs = articleHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
                            const text = paragraphs
                                .map(p => p.replace(/<[^>]*>/g, '').trim())
                                .filter(p => p.length > 30 && !p.includes('Copyright') && !p.includes('function'))
                                .join(' ');
                            
                            if (text.length > 50) {
                                desc = cleanNewsText(text);
                            }
                        } catch (e) {}
                        
                        if (isGarbageDescription(desc) || desc.length < 10) desc = article.title;
                        
                        n.push({
                            source: '🌍 BBC Sinhala',
                            category: 'International News',
                            title: article.title,
                            description: formatNewsText(fixLineBreaks(desc), article.title),
                            url: article.url,
                            image: image,
                            date: ''
                        });
                        
                        console.log(`✅ BBC: ${article.title.substring(0, 50)}...`);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                    
                    console.log(`🌍 BBC Sinhala: ${n.length} articles`);
                    return n;
                }
            } catch (e) {
                console.error('❌ BBC direct page error:', e.message);
            }
            
            console.log('❌ BBC: All methods failed');
            return n;
        }
        
        // Parse RSS XML
        const items = rssData.match(/<item>([\s\S]*?)<\/item>/gi) || [];
        console.log(`📰 BBC RSS: Found ${items.length} items`);
        
        for (const item of items.slice(0, 5)) {
            try {
                const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
                const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
                const descMatch = item.match(/<description>([\s\S]*?)<\/description>/i);
                const mediaMatch = item.match(/<media:thumbnail[^>]*url="([^"]*)"/i) || 
                                  item.match(/<media:content[^>]*url="([^"]*)"/i);
                
                if (!titleMatch?.[1] || !linkMatch?.[1]) continue;
                
                let title = cleanNewsText(titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, ''));
                let url = linkMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '');
                let description = '';
                let image = FALLBACK_IMAGE;
                
                if (descMatch?.[1]) {
                    description = cleanNewsText(descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, ''));
                }
                if (mediaMatch?.[1]) {
                    image = mediaMatch[1];
                }
                
                // Clean description
                description = description
                    .replace(/<[^>]*>/g, '')
                    .replace(/\[CDATA\[|\]\]/g, '')
                    .trim();
                
                if (description.length < 20 || isGarbageDescription(description)) {
                    // Try to get better description from article
                    try {
                        const articleRes = await axios.get(url, {
                            timeout: 10000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                            }
                        });
                        const articleHtml = articleRes.data;
                        
                        const ogImg = articleHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
                        if (ogImg?.[1]) image = ogImg[1];
                        
                        const paragraphs = articleHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
                        const text = paragraphs
                            .map(p => p.replace(/<[^>]*>/g, '').trim())
                            .filter(p => p.length > 30 && !p.includes('Copyright'))
                            .join(' ');
                        
                        if (text.length > 50) {
                            description = cleanNewsText(text);
                        }
                    } catch (e) {}
                }
                
                if (!description || description.length < 10) {
                    description = title;
                }
                
                if (title && url && title.length > 10) {
                    n.push({
                        source: '🌍 BBC Sinhala',
                        category: 'International News',
                        title: title,
                        description: formatNewsText(fixLineBreaks(description), title),
                        url: url,
                        image: image,
                        date: ''
                    });
                    
                    console.log(`✅ BBC: ${title.substring(0, 50)}...`);
                }
            } catch (e) {
                console.error('❌ BBC item parse error:', e.message);
            }
            await new Promise(r => setTimeout(r, 500));
        }
        
        console.log(`🌍 BBC Sinhala: ${n.length} articles`);
        return n;
        
    } catch (error) {
        console.error('❌ BBC Sinhala fetch error:', error.message);
        return n;
    }
}

module.exports = fetchBBCSinhalaNews;