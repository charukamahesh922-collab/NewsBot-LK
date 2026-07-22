// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║            🏏 BBC Cricket News 🏏                            ║
// ╚══════════════════════════════════════════════════════════════╝

const axios = require('axios');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText } = require('./utils');

const FALLBACK_IMAGE = config.fallbackImage;

async function scrapeBBCArticle(url) {
    try {
        const res = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        const html = res.data;
        let description = '';
        let image = FALLBACK_IMAGE;

        // Method 1: BBC text blocks
        const textBlocks = html.match(/<p[^>]*data-component="text-block"[^>]*>([\s\S]*?)<\/p>/gi) || [];
        const paragraphs = [];

        for (const block of textBlocks) {
            let text = block.replace(/<[^>]*>/g, '').trim();
            text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            if (text.length > 30 && !text.includes('Copyright') && !text.includes('function') && !text.includes('BBC Sport')) {
                paragraphs.push(text);
            }
        }

        // Method 2: Article body
        if (paragraphs.length < 2) {
            const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
            const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
            const bodyHtml = articleMatch?.[1] || mainMatch?.[1] || html;

            const allParagraphs = bodyHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
            for (const p of allParagraphs) {
                let text = p.replace(/<[^>]*>/g, '').trim();
                text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                if (text.length > 30 && !text.includes('Copyright') && !text.includes('function') && !text.includes('BBC Sport')) {
                    paragraphs.push(text);
                }
            }
        }

        // Method 3: og:description
        if (paragraphs.length === 0) {
            const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
            if (ogDesc?.[1] && ogDesc[1].length > 100) {
                description = cleanNewsText(ogDesc[1]);
            }
        }

        if (paragraphs.length > 0) {
            description = cleanNewsText(paragraphs.join('\n\n'));
        }

        // Get image
        const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogImg?.[1]) image = ogImg[1];

        return { description, image };
    } catch (e) {
        return { description: '', image: FALLBACK_IMAGE };
    }
}

async function fetchBBCCricketNews() {
    const n = [];
    try {
        console.log('🏏 Fetching BBC Cricket news...');

        const rssRes = await axios.get('https://feeds.bbci.co.uk/sport/cricket/rss.xml', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            }
        });

        const items = rssRes.data.match(/<item>[\s\S]*?<\/item>/gi) || [];
        console.log(`🏏 BBC Cricket RSS: ${items.length} items`);

        for (const item of items.slice(0, 2)) {
            try {
                const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
                const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i);
                const imgMatch = item.match(/<media:thumbnail[^>]*url="([^"]*)"[^>]*>/i) ||
                                item.match(/<media:content[^>]*url="([^"]*)"[^>]*>/i);

                if (titleMatch?.[1] && linkMatch?.[1]) {
                    const title = cleanNewsText(titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, ''));
                    let url = linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
                    url = url.replace(/\?at_medium=RSS.*$/, '');

                    console.log(`🏏 BBC Cricket: Scraping "${title.substring(0, 40)}..."`);
                    const articleData = await scrapeBBCArticle(url);

                    let desc = articleData.description;
                    let image = articleData.image || imgMatch?.[1] || FALLBACK_IMAGE;

                    // Only fallback to RSS if article scrape failed
                    if (!desc || desc.length < 100) {
                        const descMatch = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i);
                        if (descMatch?.[1]) {
                            desc = cleanNewsText(descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, ''));
                            desc = desc.replace(/<[^>]*>/g, '').trim();
                        }
                    }

                    if (!desc || desc.length < 30) desc = title;

                    n.push({
                        source: '🏏 BBC Cricket',
                        category: 'Cricket',
                        title: title,
                        description: formatNewsText(fixLineBreaks(desc), title),
                        url: url,
                        image: image,
                        date: ''
                    });

                    console.log(`🏏 BBC Cricket: ${title.substring(0, 40)}... [${desc.length} chars]`);
                }
            } catch (e) {
                console.error('🏏 BBC Cricket item error:', e.message);
            }
            await new Promise(r => setTimeout(r, 500));
        }

    } catch (e) {
        console.error('❌ BBC Cricket fetch error:', e.message);
    }

    console.log(`🏏 BBC Cricket: ${n.length} articles`);
    return n;
}

module.exports = fetchBBCCricketNews;
