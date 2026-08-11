
// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║              🔴 Sinhala Ada Derana News 🔴                  ║
// ║     Full Article Description Extraction                    ║
// ╚══════════════════════════════════════════════════════════════╝

const axios = require('axios');
const cheerio = require('cheerio');

const FALLBACK_IMAGE = 'https://via.placeholder.com/800x400/1a1a2e/ffffff?text=Ada+Derana+Sinhala';
const BASE_URL = 'https://sinhala.adaderana.lk';

// ✅ ALL SECTIONS
const SECTIONS = [
    { 
        name: 'උණුසුම් පුවත්', 
        category: '🔥 Hot News', 
        url: `${BASE_URL}/sinhala-hot-news.php`,
        type: 'list'
    },
    { 
        name: 'ව්‍යාපාරික පුවත්', 
        category: '💼 Business', 
        url: 'http://biz.adaderana.lk/',
        type: 'external'
    },
    { 
        name: 'විශේෂාංග', 
        category: '📰 Features', 
        url: `${BASE_URL}/other-news.php?sid=60`,
        type: 'list'
    },
    { 
        name: 'වෙනත් පුවත්', 
        category: '📌 Other News', 
        url: `${BASE_URL}/other-news.php?sid=45`,
        type: 'list'
    },
    { 
        name: 'ක්‍රීඩා පිටිය', 
        category: '⚽ Sports', 
        url: `${BASE_URL}/other-news.php?sid=39`,
        type: 'list'
    },
    { 
        name: 'සයුරෙන් එතෙර', 
        category: '🌍 Foreign', 
        url: `${BASE_URL}/other-news.php?sid=43`,
        type: 'list'
    }
];

// ✅ BUILT-IN HELPER FUNCTIONS

function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isValidDate(dateStr) {
    if (!dateStr) return false;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return false;
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (date > now) return false;
        if (date < sevenDaysAgo) {
            const daysOld = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            console.log(`⏭️ Skipping old article (${daysOld} days old)`);
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

function getCleanDate(dateStr) {
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

function isGarbage(text) {
    if (!text) return true;
    if (text.length < 30) return true;
    const garbage = ['subscribe', 'follow us', 'share this', 'comment below', 'like us', 'visit our', 'click here'];
    return garbage.some(word => text.toLowerCase().includes(word));
}

// ✅ FULL ARTICLE SCRAPER - Gets complete description
async function scrapeFullArticle(url) {
    let title = '';
    let description = '';
    let image = '';
    let date = '';
    let author = '';
    
    try {
        console.log(`📄 Scraping article: ${url.substring(0, 60)}...`);
        
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'si,en-US;q=0.9,en;q=0.8'
            }
        });
        
        const html = response.data;
        const $ = cheerio.load(html);
        
        // ✅ 1. Get Title
        const titleTag = $('h1.entry-title, h1.title, h1.post-title, h1.article-title, .entry-title h1, .post-title h1');
        if (titleTag.length) {
            title = cleanText(titleTag.first().text());
        }
        if (!title) {
            const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
            if (ogTitle && ogTitle[1]) {
                title = cleanText(ogTitle[1]);
            }
        }
        
        // ✅ 2. Get Description - Try multiple methods
        let descriptionParts = [];
        
        // Method A: Get all paragraphs from article content
        const contentSelectors = [
            '.entry-content',
            '.post-content',
            '.article-content',
            '.content',
            '.story-content',
            '.news-content',
            '.post-body',
            '.article-body',
            '.main-content article',
            'article .content',
            '.single-content',
            '.entry',
            '.post'
        ];
        
        let contentElement = null;
        for (const selector of contentSelectors) {
            const el = $(selector);
            if (el.length > 0) {
                contentElement = el;
                break;
            }
        }
        
        if (contentElement) {
            // Get all paragraphs
            contentElement.find('p').each((i, element) => {
                const text = $(element).text().trim();
                if (text.length > 30 && 
                    !text.toLowerCase().includes('advertising') &&
                    !text.toLowerCase().includes('advertisement') &&
                    !text.toLowerCase().includes('subscribe') &&
                    !text.toLowerCase().includes('newsletter') &&
                    !text.toLowerCase().includes('share this')) {
                    descriptionParts.push(text);
                }
            });
            
            // If no paragraphs found, try divs with text
            if (descriptionParts.length === 0) {
                contentElement.find('div').each((i, element) => {
                    const text = $(element).text().trim();
                    if (text.length > 50 && 
                        !text.toLowerCase().includes('advertising') &&
                        !text.toLowerCase().includes('share this')) {
                        descriptionParts.push(text);
                    }
                });
            }
        }
        
        // Method B: If no content found, try og:description
        if (descriptionParts.length === 0) {
            const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
            if (ogDesc && ogDesc[1]) {
                const desc = cleanText(ogDesc[1]);
                if (desc.length > 50) {
                    descriptionParts.push(desc);
                }
            }
        }
        
        // Method C: Try Twitter description
        if (descriptionParts.length === 0) {
            const twitterDesc = html.match(/<meta[^>]*name="twitter:description"[^>]*content="([^"]*)"[^>]*>/i);
            if (twitterDesc && twitterDesc[1]) {
                const desc = cleanText(twitterDesc[1]);
                if (desc.length > 50) {
                    descriptionParts.push(desc);
                }
            }
        }
        
        // Method D: Try meta description
        if (descriptionParts.length === 0) {
            const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
            if (metaDesc && metaDesc[1]) {
                const desc = cleanText(metaDesc[1]);
                if (desc.length > 50) {
                    descriptionParts.push(desc);
                }
            }
        }
        
        // Method E: Try to find any large text blocks
        if (descriptionParts.length === 0) {
            $('div').each((i, element) => {
                const text = $(element).text().trim();
                if (text.length > 200 && 
                    !text.toLowerCase().includes('advertising') &&
                    !text.toLowerCase().includes('sidebar') &&
                    !text.toLowerCase().includes('menu') &&
                    !text.toLowerCase().includes('footer') &&
                    !text.toLowerCase().includes('copyright')) {
                    // Check if it's likely the article content
                    if (text.includes('මෙය') || text.includes('කියා') || text.includes('පැවසී')) {
                        descriptionParts.push(text);
                    }
                }
            });
        }
        
        // ✅ Combine description parts (limit to 3-4 paragraphs)
        let fullDescription = '';
        if (descriptionParts.length > 0) {
            // Take first 4 paragraphs max
            const maxParas = Math.min(descriptionParts.length, 4);
            const selectedParts = descriptionParts.slice(0, maxParas);
            
            // Clean each part
            const cleanedParts = selectedParts.map(p => cleanText(p));
            
            // Join with newlines
            fullDescription = cleanedParts.join('\n\n');
        }
        
        // ✅ If still no description, use title
        if (!fullDescription || fullDescription.length < 30) {
            fullDescription = title || 'No description available';
        }
        
        // ✅ 3. Get Image
        // Try og:image
        const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogImg && ogImg[1]) {
            image = ogImg[1];
            if (image.startsWith('//')) image = `https:${image}`;
            image = image.replace('/thumb/', '/large/');
            image = image.replace('/small/', '/large/');
        }
        
        // Try Twitter image
        if (!image) {
            const twitterImg = html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]*)"[^>]*>/i);
            if (twitterImg && twitterImg[1]) {
                image = twitterImg[1];
                if (image.startsWith('//')) image = `https:${image}`;
                image = image.replace('/thumb/', '/large/');
                image = image.replace('/small/', '/large/');
            }
        }
        
        // Try first image in article
        if (!image) {
            const firstImg = $('.entry-content img, .post-content img, .article-content img, .content img').first();
            if (firstImg.length) {
                image = firstImg.attr('src') || firstImg.attr('data-src') || '';
                if (image && !image.startsWith('http')) {
                    if (image.startsWith('//')) {
                        image = `https:${image}`;
                    } else {
                        image = `${BASE_URL}${image.startsWith('/') ? '' : '/'}${image}`;
                    }
                }
                image = image.replace('/thumb/', '/large/');
                image = image.replace('/small/', '/large/');
            }
        }
        
        // ✅ 4. Get Date
        const dateSelectors = [
            '.entry-date',
            '.post-date',
            '.published',
            '.date',
            '.time',
            '.post-time',
            '.article-date',
            '.meta-date'
        ];
        
        for (const selector of dateSelectors) {
            const el = $(selector);
            if (el.length) {
                const d = cleanText(el.first().text());
                if (d && d.length > 5) {
                    date = d;
                    break;
                }
            }
        }
        
        if (!date) {
            const dateMatch = html.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+(am|pm)/i);
            if (dateMatch) {
                date = `${dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]} ${dateMatch[4]}:${dateMatch[5]} ${dateMatch[6]}`;
            }
        }
        
        // ✅ 5. Get Author
        const authorSelectors = [
            '.author',
            '.byline',
            '.post-author',
            '.entry-author',
            '.meta-author'
        ];
        
        for (const selector of authorSelectors) {
            const el = $(selector);
            if (el.length) {
                author = cleanText(el.first().text());
                if (author) break;
            }
        }
        
        // Clean the full description
        fullDescription = cleanText(fullDescription);
        fullDescription = fullDescription
            .replace(/Ada Derana.*$/gi, '')
            .replace(/ශ්‍රී ලංකා ප්‍රවෘත්ති.*$/gi, '')
            .replace(/Share this article.*$/gi, '')
            .replace(/Post a comment.*$/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // If description is still garbage, use title
        if (isGarbage(fullDescription) || fullDescription.length < 30) {
            fullDescription = title || 'No description available';
        }
        
        console.log(`✅ Article scraped: ${title ? title.substring(0, 30) : 'No title'}... (${fullDescription.length} chars)`);
        
        return { 
            title: title || '', 
            description: fullDescription, 
            image: image || FALLBACK_IMAGE,
            date: date || getCleanDate(new Date()),
            author: author || ''
        };
        
    } catch (error) {
        console.log(`⚠️ Article scrape error: ${error.message}`);
        return { 
            title: '', 
            description: '', 
            image: FALLBACK_IMAGE,
            date: getCleanDate(new Date()),
            author: ''
        };
    }
}

// ✅ FETCH NEWS FROM A SECTION
async function fetchSectionNews(section) {
    const articles = [];
    try {
        console.log(`📰 Fetching ${section.name}...`);
        
        if (section.type === 'external') {
            console.log(`⏭️ Skipping external: ${section.url}`);
            return articles;
        }
        
        const response = await axios.get(section.url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Try different selectors
        const selectors = [
            '.news-item',
            '.post-item',
            '.article-item',
            '.latest-news-item',
            '.news-card',
            '.post-card',
            '.article-card',
            'article',
            '.post',
            '.news',
            '.item',
            '.list-item',
            '.block-item',
            '.entry',
            '.post-entry',
            '.content-item',
            '.story-item',
            '.featured-item'
        ];
        
        let found = false;
        
        for (const selector of selectors) {
            const items = $(selector);
            if (items.length > 0) {
                console.log(`✅ Found ${items.length} items using: ${selector}`);
                found = true;
                
                items.each((i, element) => {
                    if (i >= 5) return false;
                    const $el = $(element);
                    
                    // Get title
                    let title = $el.find('h1, h2, h3, h4, .title, .heading, .headline, .entry-title')
                        .first()
                        .text()
                        .trim();
                    
                    if (!title) {
                        title = $el.find('a').first().text().trim();
                    }
                    if (!title || title.length < 10) return;
                    
                    // Get URL
                    let url = $el.find('a[href*="/news/"]').first().attr('href');
                    if (!url) {
                        url = $el.find('a').first().attr('href');
                    }
                    if (!url) return;
                    
                    if (url && !url.startsWith('http')) {
                        if (url.startsWith('//')) {
                            url = `https:${url}`;
                        } else {
                            url = `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
                        }
                    }
                    
                    // Skip duplicates
                    if (articles.some(a => a.url === url)) return;
                    
                    // Get date from list
                    let date = $el.find('.date, .time, .published, .post-date, .entry-date')
                        .first()
                        .text()
                        .trim();
                    
                    articles.push({
                        title: title,
                        url: url,
                        date: date || '',
                        category: section.category
                    });
                });
                
                if (articles.length > 0) break;
            }
        }
        
        // ✅ FALLBACK: Find links with /news/ in URL
        if (articles.length === 0) {
            console.log(`🔄 Fallback for ${section.name}...`);
            $('a[href*="/news/"]').each((i, element) => {
                if (i >= 10) return false;
                const $el = $(element);
                const href = $el.attr('href');
                const text = $el.text().trim();
                
                if (href && text && text.length > 20) {
                    let url = href;
                    if (!url.startsWith('http')) {
                        if (url.startsWith('//')) {
                            url = `https:${url}`;
                        } else {
                            url = `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
                        }
                    }
                    
                    if (articles.some(a => a.url === url)) return;
                    
                    articles.push({
                        title: text,
                        url: url,
                        date: '',
                        category: section.category
                    });
                }
            });
        }
        
        console.log(`✅ ${section.name}: Found ${articles.length} article links`);
        
    } catch (error) {
        console.log(`⚠️ ${section.name} error: ${error.message}`);
    }
    
    return articles;
}

// ✅ MAIN FUNCTION
async function fetchSinhalaAdaDeranaNews() {
    const n = [];
    try {
        console.log('📰 Fetching Sinhala Ada Derana News from all sections...');
        
        // Fetch from all sections
        for (const section of SECTIONS) {
            const articles = await fetchSectionNews(section);
            
            // Process each article (limit 3 per section)
            for (const a of articles.slice(0, 3)) {
                const u = a.url || '', t = a.title || '';
                if (u && t && !n.some(article => article.url === u)) {
                    try {
                        // ✅ SCRAPE FULL ARTICLE
                        const articleData = await scrapeFullArticle(u);
                        
                        // Use scraped data, fallback to list data
                        const title = articleData.title || t;
                        const description = articleData.description || t;
                        const image = articleData.image || FALLBACK_IMAGE;
                        const date = articleData.date || a.date || getCleanDate(new Date());
                        
                        n.push({
                            source: '🔴 Ada Derana Sinhala',
                            category: section.category || 'Latest',
                            title: cleanText(title),
                            description: cleanText(description) || t,
                            url: u,
                            image: image,
                            date: date
                        });
                        
                        console.log(`✅ Added: ${title.substring(0, 40)}...`);
                        await new Promise(r => setTimeout(r, 1000)); // Rate limit
                        
                    } catch (e) {
                        console.log(`⚠️ Error processing article: ${e.message}`);
                    }
                }
            }
        }
        
    } catch (e) {
        console.error('❌ Sinhala Ada Derana error:', e.message);
    }
    
    console.log(`✅ Sinhala Ada Derana: ${n.length} total articles`);
    return n;
}

module.exports = fetchSinhalaAdaDeranaNews;
