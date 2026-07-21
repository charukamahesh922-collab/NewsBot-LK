const fetchHiruNews = require('./hiru');
const fetchDeranaNews = require('./derana');
const fetchAdaDeranaRSS = require('./adaderana');
const fetchSirasaNews = require('./sirasa');
const fetchAdaLkNews = require('./adalk');
const fetchNewswireNews = require('./newswire');
const fetchCricketNews = require('./cricket');
const fetchBBCSinhalaNews = require('./bbc');
const fetchEsanaNews = require('./esana');
const fetchSinhalaCricketNews = require('./cricketsi');
const fetchSportyNews = require('./sporty');

async function fetchAllLatestNews() {
    console.log('\n📰 Fetching news from all sources...');
    
    const sources = [
        { name: 'Hiru', fetch: fetchHiruNews },
        { name: 'Derana', fetch: fetchDeranaNews },
        { name: 'AdaDerana RSS', fetch: fetchAdaDeranaRSS },
        { name: 'Sirasa', fetch: fetchSirasaNews },
        { name: 'Ada.lk', fetch: fetchAdaLkNews },
        { name: 'Newswire', fetch: fetchNewswireNews },
        { name: 'Cricinfo', fetch: fetchCricketNews },
        { name: 'BBC Sinhala', fetch: fetchBBCSinhalaNews },
        { name: 'Helakuru Esana', fetch: fetchEsanaNews },
        { name: 'ThePapare', fetch: fetchSinhalaCricketNews },
        { name: 'Sporty.lk', fetch: fetchSportyNews },
    ];
    
    // ... rest same
    
    const results = await Promise.allSettled(sources.map(s => s.fetch()));
    const allNews = [];
    
    sources.forEach((s, i) => {
        if (results[i].status === 'fulfilled') {
            try {
                const articles = results[i].value;
                if (Array.isArray(articles) && articles.length > 0) {
                    console.log(`  ✅ ${s.name}: ${articles.length} articles`);
                    allNews.push(...articles);
                } else {
                    console.log(`  ❌ ${s.name}: No articles`);
                }
            } catch (e) {
                console.log(`  ❌ ${s.name}: ${e.message}`);
            }
        } else {
            console.log(`  ❌ ${s.name}: ${results[i].reason?.message || 'Failed'}`);
        }
    });
    
    const unique = [];
    const seen = new Set();
    for (const a of allNews) {
        try {
            if (a.url && !seen.has(a.url)) {
                seen.add(a.url);
                unique.push(a);
            }
        } catch (e) {}
    }
    
    console.log(`📊 Total: ${allNews.length} | Unique: ${unique.length}\n`);
    return unique;
}

module.exports = fetchAllLatestNews;