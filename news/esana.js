// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║              📱 Helakuru Esana News 📱                       ║
// ╚══════════════════════════════════════════════════════════════╝

const axios = require('axios');
const config = require('../config');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText } = require('./utils');

const FALLBACK_IMAGE = config.fallbackImage;
const API_URL = 'https://esena-news-api-v3.vercel.app/';

function extractFullContent(contentArray, title) {
    if (!contentArray || !Array.isArray(contentArray)) return '';
    
    const texts = [];
    
    for (const item of contentArray) {
        // Debug: log all keys of the item
        const keys = Object.keys(item);
        
        // Try to find text in any field
        let foundText = '';
        
        // Check common text fields
        const textFields = ['text', 'content', 'value', 'data', 'body', 'html', 'description', 'caption', 'paragraph', 'title', 'heading'];
        for (const field of textFields) {
            if (item[field] && typeof item[field] === 'string' && item[field].trim().length > 10) {
                foundText = item[field].trim();
                break;
            }
        }
        
        // If still not found, check if the item itself is a string
        if (!foundText && typeof item === 'string') {
            foundText = item.trim();
        }
        
        // Skip if matches title
        if (title && foundText === title) continue;
        
        if (foundText && foundText.length > 15) {
            texts.push(foundText);
        }
        
        // Check nested arrays
        for (const key of keys) {
            if (Array.isArray(item[key]) && key !== 'media' && key !== 'sub_img') {
                const nested = extractFullContent(item[key], title);
                if (nested) texts.push(nested);
            }
        }
    }
    
    return texts.join('\n\n');
}

async function fetchEsanaNews() {
    const n = [];
    try {
        console.log('📱 Fetching Helakuru Esana news...');
        
        const response = await axios.get(API_URL, {
            timeout: 15000,
            headers: {
                'User-Agent': 'NewsBot-LK/9.0',
                'Accept': 'application/json'
            }
        });
        
        const data = response.data;
        if (!data || !data.news_data || !data.news_data.data) {
            console.log('❌ Esana API: Invalid response');
            return n;
        }
        
        const articles = data.news_data.data;
        console.log(`📱 Esana API: Got ${articles.length} articles`);
        
        // Debug first article structure
        if (articles[0] && articles[0].contentSi && articles[0].contentSi[0]) {
            console.log('📱 Esana sample item keys:', Object.keys(articles[0].contentSi[0]));
            console.log('📱 Esana sample item:', JSON.stringify(articles[0].contentSi[0]).substring(0, 200));
        }
        
        for (const article of articles.slice(0, 3)) {
            try {
                const title = cleanNewsText(article.titleSi || article.titleEn || '');
                
                // Extract content
                let description = extractFullContent(article.contentSi, title);
                
                // If short, try English
                if ((!description || description.length < 30) && article.contentEn) {
                    const enDesc = extractFullContent(article.contentEn, title);
                    if (enDesc.length > description.length) {
                        description = enDesc;
                    }
                }
                
                // Final fallback
                if (!description || description.length < 15 || isGarbageDescription(description)) {
                    description = title;
                }
                
                const url = article.share_url || `https://www.helakuru.lk/esana/${article.id}`;
                const image = article.cover || article.thumb || FALLBACK_IMAGE;
                const date = article.published || '';
                
                if (title && title.length > 10) {
                    n.push({
                        source: '📱 Helakuru Esana',
                        category: 'Latest News',
                        title: title,
                        description: formatNewsText(fixLineBreaks(description), title),
                        url: url,
                        image: image,
                        date: date
                    });
                    
                    console.log(`📱 Esana: ${title.substring(0, 40)}... [${description.length} chars]`);
                }
            } catch (e) {
                console.error(`📱 Esana article error:`, e.message);
            }
        }
        
    } catch (e) {
        console.error('❌ Esana API error:', e.message);
    }
    
    console.log(`📱 Esana: ${n.length} articles`);
    return n;
}

module.exports = fetchEsanaNews;