// NewsAPI — free tier (100 requests/day), just an API key
const axios = require('axios');

async function fetchNews() {
  const key = process.env.NEWS_API_KEY;
  if (!key) return [];
  try {
    const topics = (process.env.NEWS_TOPICS || 'technology,science').split(',').map(t => t.trim());
    const query = topics.join(' OR ');
    const { data } = await axios.get(`https://newsapi.org/v2/top-headlines?language=en&pageSize=15&apiKey=${key}&q=${encodeURIComponent(query)}`);
    return (data.articles || []).map(a => ({
      title: a.title, description: a.description, url: a.url,
      source: a.source?.name, published_at: a.publishedAt, image: a.urlToImage,
    }));
  } catch (e) { console.error('News:', e.message); return []; }
}

module.exports = { fetchNews, isConfigured: () => !!process.env.NEWS_API_KEY };
