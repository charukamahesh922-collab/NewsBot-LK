// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🔧 Shared Utilities 🔧                      ║
// ╚══════════════════════════════════════════════════════════════╝

const axios = require('axios');

function decodeHTMLEntities(text) {
    if (!text || typeof text !== 'string') return '';
    const entities = {
        '&#x27;': "'", '&#x2018;': "'", '&#x2019;': "'", '&#x201C;': '"', '&#x201D;': '"',
        '&#x2013;': '–', '&#x2014;': '—', '&#x2026;': '…',
        '&#x26;': '&', '&#x3C;': '<', '&#x3E;': '>',
        '&#x200D;': '', '&#x200B;': '', '&#x00A0;': ' ',
        '&#39;': "'", '&#8216;': "'", '&#8217;': "'", '&#8220;': '"', '&#8221;': '"',
        '&#8211;': '–', '&#8212;': '—', '&#8230;': '…',
        '&#38;': '&', '&#60;': '<', '&#62;': '>', '&#34;': '"',
        '&#8205;': '', '&#8203;': '', '&#160;': ' ',
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
        '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—',
        '&lsquo;': "'", '&rsquo;': "'", '&ldquo;': '"', '&rdquo;': '"',
        '&hellip;': '…', '&bull;': '•', '&zwj;': '', '&zwnj;': '',
    };
    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
        result = result.split(entity).join(char);
    }
    result = result.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
    result = result.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
    return result;
}

function cleanNewsText(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = decodeHTMLEntities(text);
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleaned = cleaned.replace(/\u200B/g, '').replace(/\u200C/g, '').replace(/\u200D/g, '').replace(/\uFEFF/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

function isGarbageDescription(desc) {
    if (!desc || desc.length < 20) return true;
    if (/^https?:\/\/[^\s]+$/.test(desc.trim())) return true;
    const garbage = [
        'Ada.lk – Sri Lanka 24 Hours Sinhala Breaking News',
        'LatestSportsBusiness',
        'Your browser does not support',
        'HomeLatestSportsBusinessScience',
        'X Youtube Rss Email Alerts',
        'Copyright',
        'googletag',
        'window.',
        'function(',
        'Advertisement',
        'Hiru News Most visited website',
        'Most visited website in Sri Lanka',
        'Rayynor Silva Holdings',
        'Welcome to the No1 online news',
        'Sri Lanka Latest news updates',
        'Sri Lanka News updates and discussions',
        'ENGLISH Edition',
        'espn.in',
        'espncricinfo.com',
        'cricinfo.com',
    ];
    return garbage.some(p => desc.toLowerCase().includes(p.toLowerCase()));
}

function fixLineBreaks(text) {
    if (!text) return '';
    return text.replace(/(\d+)\.\s*\n\s*(\d+)/g, '$1.$2')
        .replace(/\n\s*\n/g, '\n\n').replace(/\n/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

function formatNewsText(text, fallbackText) {
    let formatted = cleanNewsText(text || fallbackText || '');
    if (!formatted || formatted.length < 10 || isGarbageDescription(formatted))
        formatted = cleanNewsText(fallbackText || '📰 Read more at the link');
    const words = formatted.split(' ');
    if (words.length > 10) {
        const half = Math.floor(words.length / 2);
        if (words.slice(0, half).join(' ') === words.slice(half).join(' '))
            formatted = words.slice(0, half).join(' ');
    }
    return formatted || '📰 Read more at the link';
}

function smartTruncate(text, maxLength = 2500) {
    if (!text || text.length <= maxLength) return text;
    const truncated = text.substring(0, maxLength);
    const cutPoints = [
        truncated.lastIndexOf('. '), truncated.lastIndexOf('? '),
        truncated.lastIndexOf('! '), truncated.lastIndexOf('\n'),
        truncated.lastIndexOf('।'), truncated.lastIndexOf(' ')
    ].filter(p => p > maxLength * 0.6);
    if (cutPoints.length > 0) return truncated.substring(0, Math.max(...cutPoints) + 1).trim() + '...';
    return truncated.trim() + '...';
}

async function scrapeArticleWithImage(url) {
    try {
        const timeout = url.includes('bbc.com') ? 20000 : 15000;
        const res = await axios.get(url, {
            timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        const html = res.data;
        if (!html || typeof html !== 'string') return { description: '', image: '' };

        let img = '';
        const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
        if (ogImage?.[1]) img = ogImage[1];
        if (!img) {
            const twImage = html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]*)"[^>]*>/i);
            if (twImage?.[1]) img = twImage[1];
        }
        if (!img && url.includes('sinhala.adaderana.lk')) {
            const id = url.split('/').pop();
            img = `https://sinhala.adaderana.lk/news/featured-image/${id}`;
        }

        let description = '';
        const patterns = [
            /<div[^>]*class="[^"]*news-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*class="[^"]*story-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<article[^>]*>([\s\S]*?)<\/article>/i,
            /<main[^>]*>([\s\S]*?)<\/main>/i
        ];
        for (const p of patterns) {
            const m = html.match(p);
            if (m?.[1]) {
                const ps = m[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
                const text = ps.map(x => x.replace(/<[^>]*>/g, '').trim())
                    .filter(x => x.length > 30 && !x.includes('googletag') && !x.includes('Advertisement'))
                    .join(' ');
                if (text.length > 100) { description = cleanNewsText(text); break; }
            }
        }
        if (!description || description.length < 50) {
            const meta = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
            if (meta?.[1] && !isGarbageDescription(meta[1])) description = cleanNewsText(meta[1]);
        }
        if (!description || description.length < 50) {
            const allPs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
            const text = allPs.map(x => x.replace(/<[^>]*>/g, '').trim())
                .filter(x => x.length > 30 && !x.includes('googletag') && !x.includes('Advertisement') && !x.includes('Share this'))
                .join(' ');
            if (text.length > 50) description = cleanNewsText(text);
        }
        return { description: description || '', image: img || '' };
    } catch (e) { return { description: '', image: '' }; }
}

// EXPORT ALL FUNCTIONS
module.exports = {
    decodeHTMLEntities,
    cleanNewsText,
    isGarbageDescription,
    fixLineBreaks,
    formatNewsText,
    smartTruncate,
    scrapeArticleWithImage
};