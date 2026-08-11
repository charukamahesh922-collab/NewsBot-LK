
// news/adaderana.js - Completely Self-Contained (No utils needed)

const axios = require('axios');

const FALLBACK_IMAGE = 'https://via.placeholder.com/800x400/1a1a2e/ffffff?text=Ada+Derana';

// ═══════════════════════════════════════════════════════════════
// 📅 DATE FUNCTIONS (Built-in)
// ═══════════════════════════════════════════════════════════════

function isValidArticleDate(dateStr) {
    if (!dateStr) return false;
    try {
        const articleDate = new Date(dateStr);
        if (isNaN(articleDate.getTime())) return false;
        const now = new Date();
        if (articleDate > now) return false;
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (articleDate < sevenDaysAgo) {
            const daysOld = Math.floor((now - articleDate) / (1000 * 60 * 60 * 24));
            console.log(`⏭️ Skipping old article (${daysOld} days old)`);
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

function getCleanDate(dateStr) {
    if (!dateStr) {
        return new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    }
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return new Date().toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        }
        return date.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    } catch (e) {
        return new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// 📝 TEXT CLEANING FUNCTIONS (Built-in)
// ═══════════════════════════════════════════════════════════════

function cleanDescription(text) {
    if (!text) return '';
    let cleaned = text;
    
    // Remove everything before "Latest" or actual content start
    cleaned = cleaned.replace(/^.*?Latest/si, '');
    cleaned = cleaned.replace(/^.*?HomeLatest/si, '');
    
    // Remove JSON-LD completely
    cleaned = cleaned.replace(/\{"@context":[\s\S]*?\}/g, '');
    cleaned = cleaned.replace(/\{"@type":[\s\S]*?\}/g, '');
    cleaned = cleaned.replace(/"image":\s*\[.*?\]/g, '');
    cleaned = cleaned.replace(/"datePublished":\s*"[^"]*"/g, '');
    cleaned = cleaned.replace(/"author":\s*\{.*?\}/g, '');
    cleaned = cleaned.replace(/"publisher":\s*\{.*?\}/g, '');
    cleaned = cleaned.replace(/"mainEntityOfPage":\s*\{.*?\}/g, '');
    
    // Remove navigation
    cleaned = cleaned.replace(/සිංහල\s*தமிழ்.*?Home.*?Latest.*?Sports/si, '');
    cleaned = cleaned.replace(/Home\s*Latest\s*Sports\s*Business\s*Science\s*&\s*Tech/si, '');
    cleaned = cleaned.replace(/Add\s*Ada\s*Derana\s*on\s*Google/si, '');
    cleaned = cleaned.replace(/Add\s*on\s*Google/si, '');
    cleaned = cleaned.replace(/Share\s*Facebook\s*Twitter\s*WhatsApp/si, '');
    cleaned = cleaned.replace(/Share\s*[A-Za-z]*\s*Share/si, '');
    
    // Remove "Latest" headings
    cleaned = cleaned.replace(/^Latest\s*/i, '');
    cleaned = cleaned.replace(/^Latest\s*-\s*/i, '');
    
    // Remove "Add Ada Derana on Google" and similar
    cleaned = cleaned.replace(/Add\s*Ada\s*Derana\s*on\s*Google.*$/si, '');
    cleaned = cleaned.replace(/Add\s*on\s*Google.*$/si, '');
    
    // Remove "Share" and social media links
    cleaned = cleaned.replace(/Share\s*(Facebook|Twitter|WhatsApp|Email|LinkedIn).*$/si, '');
    
    // Remove "Read more" and similar
    cleaned = cleaned.replace(/Read\s*more\s*\.\.\./si, '');
    cleaned = cleaned.replace(/Continue\s*reading\s*\.\.\./si, '');
    
    // Remove "Related News" section
    cleaned = cleaned.replace(/Related\s*News.*$/si, '');
    cleaned = cleaned.replace(/Related\s*Articles.*$/si, '');
    
    // Remove "Comments" section
    cleaned = cleaned.replace(/Comments.*$/si, '');
    cleaned = cleaned.replace(/Leave\s*a\s*comment.*$/si, '');
    
    // Remove "Tags"
    cleaned = cleaned.replace(/Tags:.*$/si, '');
    cleaned = cleaned.replace(/Tagged\s*with:.*$/si, '');
    
    // Remove extra spaces and newlines
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove empty paragraphs or short garbage
    cleaned = cleaned.replace(/^[^a-zA-Z0-9\u0D80-\u0DFF]+/, '');
    
    return cleaned;
}

function isGarbageDescription(text) {
    if (!text) return true;
    if (text.length < 30) return true;
    const garbage = ['subscribe', 'follow us', 'share this', 'comment below', 'like us', 'visit our', 'click here', 'sign up'];
    return garbage.some(word => text.toLowerCase().includes(word));
}

// ═══════════════════════════════════════════════════════════════
// 📰 RSS PARSER
// ═══════════════════════════════════════════════════════════════

function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let itemMatch;
    
    while ((itemMatch = itemRegex.exec(xml)) !== null) {
        const itemContent = itemMatch[1];
        
        const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        const linkMatch = itemContent.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
        const link = linkMatch ? linkMatch[1].trim() : '';
        
        const dateMatch = itemContent.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i);
        const pubDate = dateMatch ? dateMatch[1].trim() : '';
        
        const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        const description = descMatch ? descMatch[1].trim() : '';
        
        if (title && link) {
            items.push({ title, link, pubDate: pubDate || '', description: description || '' });
        }
    }
    return items;
}

// ═══════════════════════════════════════════════════════════════
// 📰 EXTRACT ARTICLE CONTENT
// ═══════════════════════════════════════════════════════════════

function extractArticleContent(html) {
    let content = '';
    
    // Try to get article body
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
        content = articleMatch[1];
    }
    
    // If no article tag, try main content
    if (!content) {
        const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
        if (mainMatch) {
            content = mainMatch[1];
        }
    }
    
    // If no main, try content div
    if (!content) {
        const contentMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (contentMatch) {
            content = contentMatch[1];
        }
    }
    
    return content;
}

function extractParagraphs(html) {
    const paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    
    while ((match = pRegex.exec(html)) !== null) {
        const text = match[1]
            .replace(/<[^>]*>/g, '')
            .trim();
        
        if (text.length > 30 && 
            !text.toLowerCase().includes('advertising') &&
            !text.toLowerCase().includes('advertisement') &&
            !text.toLowerCase().includes('subscribe') &&
            !text.toLowerCase().includes('newsletter')) {
            paragraphs.push(text);
        }
    }
    
    return paragraphs;
}

// ═══════════════════════════════════════════════════════════════
// 📰 MAIN SCRAPER
// ═══════════════════════════════════════════════════════════════

async function fetchAdaDeranaRSS() {
    const articles = [];
    try {
        console.log('📰 Fetching Ada Derana RSS...');
        
        const response = await axios.get('https://adaderana.lk/rss.php', {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const items = parseRSS(response.data);
        console.log(`🔍 Found ${items.length} RSS items`);
        
        let validCount = 0;
        let oldCount = 0;
        
        for (const item of items) {
            try {
                const title = item.title || '';
                const link = item.link || '';
                const pubDate = item.pubDate || '';
                const description = item.description || '';
                
                if (pubDate && !isValidArticleDate(pubDate)) {
                    oldCount++;
                    console.log(`⏭️ Skipping old article: ${title.substring(0, 30)}...`);
                    continue;
                }
                
                let cleanDesc = '';
                
                // ✅ Try to get full article content by scraping
                try {
                    const articleResponse = await axios.get(link, {
                        timeout: 10000,
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });
                    const html = articleResponse.data;
                    
                    // Try og:description first
                    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
                    if (ogDesc && ogDesc[1]) {
                        cleanDesc = cleanDescription(ogDesc[1]);
                    }
                    
                    // If og:description is short, try article content
                    if (isGarbageDescription(cleanDesc) || cleanDesc.length < 50) {
                        const contentHtml = extractArticleContent(html);
                        const paragraphs = extractParagraphs(contentHtml || html);
                        
                        if (paragraphs.length > 0) {
                            const mainContent = paragraphs.slice(0, 4).join(' ');
                            if (mainContent.length > cleanDesc.length) {
                                cleanDesc = cleanDescription(mainContent);
                            }
                        }
                    }
                    
                    // If still no good description, try meta description
                    if (isGarbageDescription(cleanDesc) || cleanDesc.length < 50) {
                        const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
                        if (metaDesc && metaDesc[1]) {
                            cleanDesc = cleanDescription(metaDesc[1]);
                        }
                    }
                    
                } catch (e) {
                    // If scraping fails, use RSS description
                    cleanDesc = cleanDescription(description);
                }
                
                // Final fallback: Use title
                if (isGarbageDescription(cleanDesc) || cleanDesc.length < 30) {
                    cleanDesc = title;
                }
                
                // ✅ Get image from article
                let image = FALLBACK_IMAGE;
                try {
                    const articleResponse = await axios.get(link, {
                        timeout: 10000,
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });
                    const html = articleResponse.data;
                    
                    const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
                    if (ogImg && ogImg[1]) {
                        let imgUrl = ogImg[1];
                        if (imgUrl.startsWith('//')) imgUrl = `https:${imgUrl}`;
                        image = imgUrl;
                    }
                } catch (e) {}
                
                articles.push({
                    source: '📰 AdaDerana RSS',
                    category: 'Latest News',
                    title: title,
                    description: cleanDesc,
                    url: link,
                    image: image,
                    date: getCleanDate(pubDate)
                });
                validCount++;
                
            } catch (e) {
                console.log(`⚠️ Error processing item: ${e.message}`);
            }
        }
        
        console.log(`✅ AdaDerana RSS: ${validCount} valid articles (${oldCount} filtered out)`);
        
    } catch (error) {
        console.error('❌ AdaDerana RSS error:', error.message);
    }
    
    return articles;
}

module.exports = fetchAdaDeranaRSS;
