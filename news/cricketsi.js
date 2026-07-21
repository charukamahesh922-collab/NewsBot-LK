// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║         🏏 Sri Lanka Cricket News (ThePapare) 🏏             ║
// ╚══════════════════════════════════════════════════════════════╝

const axios = require('axios');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText } = require('./utils');

const FALLBACK_IMAGE = config.fallbackImage;

async function scrapeArticle(url) {
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
        
        const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogDesc?.[1] && ogDesc[1].length > 50 && !ogDesc[1].includes('Live Sri Lanka Cricket coverage')) {
            description = cleanNewsText(ogDesc[1]);
        }
        
        const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogImg?.[1]) image = ogImg[1];
        
        if (!description || description.length < 50) {
            const contentDiv = html.match(/<div[^>]*class="[^"]*(?:entry-content|article-content|td-post-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                              html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
            const textHtml = contentDiv ? contentDiv[1] : html;
            const paragraphs = textHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
            const text = paragraphs
                .map(p => p.replace(/<[^>]*>/g, '').trim())
                .filter(p => p.length > 30 && !p.includes('Live Sri Lanka Cricket') && !p.includes('Copyright'))
                .join(' ');
            if (text.length > 50) description = cleanNewsText(text);
        }
        
        return { description, image };
    } catch (e) { return { description: '', image: FALLBACK_IMAGE }; }
}

async function fetchSinhalaCricketNews() {
    const allArticles = [];
    
    console.log('🏏 Fetching SL cricket news...');
    
    // ThePapare
    try {
        const response = await axios.get('https://www.thepapare.com/cricket/', {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        const html = response.data;
        const seenUrls = new Set();
        
        const patterns = [
            /<h[2-4][^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]*href="(https:\/\/www\.thepapare\.com\/[^"]*\/)"[^>]*>([\s\S]*?)<\/a>/gi,
            /<h[2-4][^>]*>\s*<a[^>]*href="(https:\/\/www\.thepapare\.com\/[^"]*\/)"[^>]*>([\s\S]*?)<\/a>\s*<\/h[2-4]/gi,
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(html)) !== null && allArticles.length < 2) {
                const url = match[1];
                let title = match[2].replace(/<[^>]*>/g, '').trim();
                title = cleanNewsText(title);
                
                if (title && title.length > 20 && !seenUrls.has(url) && 
                    !url.endsWith('/cricket/') && !url.endsWith('/cricket')) {
                    seenUrls.add(url);
                    
                    const articleData = await scrapeArticle(url);
                    let desc = articleData.description || title;
                    if (!desc || desc.length < 30 || desc.includes('Live Sri Lanka Cricket coverage')) {
                        desc = title;
                    }
                    
                    allArticles.push({
                        source: '🏏 ThePapare',
                        category: 'Cricket',
                        title: title,
                        description: formatNewsText(fixLineBreaks(desc), title),
                        url: url,
                        image: articleData.image,
                        date: ''
                    });
                    console.log(`🏏 ThePapare: ${title.substring(0, 50)}...`);
                }
            }
        }
    } catch (e) {
        console.log(`⚠️ ThePapare: ${e.message}`);
    }
    
    console.log(`🏏 SL Cricket: ${allArticles.length} articles`);
    return allArticles;
}

module.exports = fetchSinhalaCricketNews;