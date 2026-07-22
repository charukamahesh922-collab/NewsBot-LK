// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║            📰 Lankadeepa News (ලංකාදීප) 📰                  ║
// ╚══════════════════════════════════════════════════════════════╝

const lankadeepaNews = require('@mrhansamala/lankadeepa-news');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText } = require('./utils');

const FALLBACK_IMAGE = config.fallbackImage;

async function fetchLankadeepaNews() {
    const n = [];
    try {
        console.log('📰 Fetching Lankadeepa news...');
        
        // Try different import methods
        let result = null;
        
        if (typeof lankadeepaNews === 'function') {
            result = await lankadeepaNews();
        } else if (lankadeepaNews.lankadeepa && typeof lankadeepaNews.lankadeepa === 'function') {
            result = await lankadeepaNews.lankadeepa();
        } else if (lankadeepaNews.default && typeof lankadeepaNews.default === 'function') {
            result = await lankadeepaNews.default();
        } else {
            // Try direct property access
            for (const key of Object.keys(lankadeepaNews)) {
                if (typeof lankadeepaNews[key] === 'function') {
                    result = await lankadeepaNews[key]();
                    break;
                }
            }
        }
        
        if (!result || !result.status) {
            console.log('❌ Lankadeepa: Invalid response');
            console.log('   Type:', typeof lankadeepaNews, 'Keys:', Object.keys(lankadeepaNews));
            return n;
        }
        
        if (result.title && result.link) {
            const title = cleanNewsText(result.title);
            let desc = cleanNewsText(result.desc || '');
            const url = result.link;
            const image = result.image || FALLBACK_IMAGE;
            const date = result.date || '';
            
            if (isGarbageDescription(desc) || desc.length < 20) {
                desc = title;
            }
            
            if (title && title.length > 10) {
                n.push({
                    source: '📰 Lankadeepa',
                    category: 'Latest News',
                    title: title,
                    description: formatNewsText(fixLineBreaks(desc), title),
                    url: url,
                    image: image,
                    date: date
                });
                console.log(`📰 Lankadeepa: ${title.substring(0, 50)}...`);
            }
        }
        
    } catch (e) {
        console.error('❌ Lankadeepa fetch error:', e.message);
    }
    
    console.log(`📰 Lankadeepa: ${n.length} articles`);
    return n;
}

module.exports = fetchLankadeepaNews;
