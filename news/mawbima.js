// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║              📰 Mawbima News (මව්බිම) 📰                     ║
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'si,en-US;q=0.7,en;q=0.3'
            }
        });
        const html = res.data;
        let description = '';
        let image = FALLBACK_IMAGE;

        const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogDesc?.[1] && ogDesc[1].length > 50) description = cleanNewsText(ogDesc[1]);

        const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogImg?.[1]) image = ogImg[1];

        if (!description || description.length < 50) {
            const contentDiv = html.match(/<div[^>]*class="[^"]*(?:entry-content|article-content|post-content|news-content|the-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                              html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
            const textHtml = contentDiv ? contentDiv[1] : html;
            const paragraphs = textHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
            const text = paragraphs
                .map(p => p.replace(/<[^>]*>/g, '').trim())
                .filter(p => p.length > 30 && !p.includes('Copyright') && !p.includes('function'))
                .join(' ');
            if (text.length > 50) description = cleanNewsText(text);
        }

        return { description, image };
    } catch (e) { return { description: '', image: FALLBACK_IMAGE }; }
}

async function fetchMawbimaNews() {
    const n = [];
    try {
        console.log('📰 Fetching Mawbima news...');

        // Use the category pages that work
        const urls = [
            'https://mawbima.lk/category/%e0%b6%af%e0%b7%9a%e0%b7%81%e0%b7%93%e0%b6%ba/', // Deshiya (Local)
            'https://mawbima.lk/',
        ];

        let html = null;
        for (const url of urls) {
            try {
                const response = await axios.get(url, {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'si,en-US;q=0.7,en;q=0.3',
                        'Referer': 'https://www.google.com/',
                    }
                });
                if (response.data && response.data.length > 5000 && !response.data.includes('cloudflare')) {
                    html = response.data;
                    console.log(`✅ Mawbima: Got HTML from ${url} (${html.length} bytes)`);
                    break;
                }
            } catch (e) {
                console.log(`⚠️ Mawbima ${url}: ${e.message}`);
            }
        }

        if (!html) {
            console.log('❌ Mawbima: Could not fetch any page');
            return n;
        }

        const seenUrls = new Set();

        // Find article links
        const patterns = [
            /<a[^>]*href="(https:\/\/mawbima\.lk\/\d+\/[^"]*\/)"[^>]*>([\s\S]*?)<\/a>/gi,
            /<a[^>]*href="(https:\/\/mawbima\.lk\/[^"]*\/)"[^>]*>[\s\S]*?<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi,
            /<h[2-4][^>]*>\s*<a[^>]*href="(https:\/\/mawbima\.lk\/[^"]*\/)"[^>]*>([\s\S]*?)<\/a>/gi,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(html)) !== null && n.length < 2) {
                const url = match[1];
                let title = match[2].replace(/<[^>]*>/g, '').trim();
                title = cleanNewsText(title);

                if (title && title.length > 20 && !seenUrls.has(url) &&
                    !url.includes('/category/') && !url.includes('/tag/') &&
                    !url.includes('/author/') && !url.endsWith('/mawbima.lk/')) {
                    seenUrls.add(url);

                    const articleData = await scrapeArticle(url);
                    let desc = articleData.description || title;
                    if (!desc || desc.length < 30) desc = title;

                    n.push({
                        source: '📰 Mawbima',
                        category: 'Latest News',
                        title: title,
                        description: formatNewsText(fixLineBreaks(desc), title),
                        url: url,
                        image: articleData.image,
                        date: ''
                    });
                    console.log(`📰 Mawbima: ${title.substring(0, 50)}...`);
                }
            }
        }

    } catch (e) {
        console.error('❌ Mawbima fetch error:', e.message);
    }

    console.log(`📰 Mawbima: ${n.length} articles`);
    return n;
}

module.exports = fetchMawbimaNews;
