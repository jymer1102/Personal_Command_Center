// NASA APOD — free, just an API key (or use DEMO_KEY for testing)
const axios = require('axios');

async function fetchAPOD() {
  const key = process.env.NASA_API_KEY || 'DEMO_KEY';
  try {
    const { data } = await axios.get(`https://api.nasa.gov/planetary/apod?api_key=${key}`);
    return { title: data.title, date: data.date, explanation: data.explanation,
      url: data.url, hdurl: data.hdurl, media_type: data.media_type, copyright: data.copyright || null };
  } catch (e) { console.error('NASA:', e.message); return null; }
}

module.exports = { fetchAPOD, isConfigured: () => true }; // DEMO_KEY works without signup
