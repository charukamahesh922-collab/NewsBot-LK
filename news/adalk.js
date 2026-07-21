// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                   📰 Ada.lk News 📰                         ║
// ╚══════════════════════════════════════════════════════════════╝

const DY_NEWS = require('@dark-yasiya/news-scrap');
const axios = require('axios');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText } = require('./utils');

const dynews = new DY_NEWS();
const FALLBACK_IMAGE = config.fallbackImage;

// Scrape Ada.lk article for full content
async function scrapeAdaLkArticle(url) {
    try {
        const res = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'si,en-US;q=0.7,en;q=0.3'
            }
        });
        
        const html = res.data;
        if (!html) return { description: '', image: '' };
        
        let description = '';
        let image = FALLBACK_IMAGE;
        
        // Get og:description
        const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogDesc?.[1] && ogDesc[1].length > 30) {
            description = cleanNewsText(ogDesc[1]);
        }
        
        // Get og:image
        const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogImg?.[1]) image = ogImg[1];
        
        // Get meta description
        if (!description || description.length < 50) {
            const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
            if (metaDesc?.[1] && metaDesc[1].length > 30 && !isGarbageDescription(metaDesc[1])) {
                description = cleanNewsText(metaDesc[1]);
            }
        }
        
        // Get article content from paragraphs
        if (!description || description.length < 50) {
            // Try to find the article body
            const articleBody = html.match(/<div[^>]*class="[^"]*(?:article-body|news-content|post-content|entry-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                               html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
            
            let textHtml = articleBody ? articleBody[1] : html;
            
            const paragraphs = textHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
            const text = paragraphs
                .map(p => p.replace(/<[^>]*>/g, '').trim())
                .filter(p => p.length > 30 && !p.includes('function') && !p.includes('Copyright') && !p.includes('Advertisement'))
                .join(' ');
            
            if (text.length > 50) {
                description = cleanNewsText(text);
            }
        }
        
        return { description, image };
    } catch (e) {
        return { description: '', image: FALLBACK_IMAGE };
    }
}

async function fetchAdaLkNews() {
    const n = [];
    try {
        const r = await dynews.ada();
        if (r?.status && r?.result) {
            const x = r.result;
            if (x.url && x.title) {
                let desc = cleanNewsText(x.desc || '');
                let image = x.image || FALLBACK_IMAGE;
                
                // If description is garbage or too short, scrape the article
                if (isGarbageDescription(desc) || desc.length < 50 || desc === cleanNewsText(x.title)) {
                    console.log(`📰 Ada.lk: Scraping article for full content...`);
                    const articleData = await scrapeAdaLkArticle(x.url);
                    if (articleData.description && articleData.description.length > 50) {
                        desc = articleData.description;
                    }
                    if (articleData.image && articleData.image !== FALLBACK_IMAGE) {
                        image = articleData.image;
                    }
                }
                
                // Remove title from beginning of description if it appears
                const cleanTitle = cleanNewsText(x.title);
                if (desc.startsWith(cleanTitle)) {
                    desc = desc.substring(cleanTitle.length).trim();
                }
                
                // If still garbage, use title
                if (isGarbageDescription(desc) || desc.length < 10) {
                    desc = cleanTitle;
                }
                
                n.push({
                    source: '📰 Ada.lk',
                    category: 'Latest',
                    title: cleanTitle,
                    description: formatNewsText(fixLineBreaks(desc), cleanTitle),
                    url: x.url,
                    image: image,
                    date: `${x.date || ''} ${x.time || ''}`.trim() || ''
                });
            }
        }
    } catch (e) {
        console.error('❌ Ada.lk fetch error:', e.message);
    }
    return n;
}

module.exports = fetchAdaLkNews;