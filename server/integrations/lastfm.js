// Last.fm — free API key, shows music scrobbles
const axios = require('axios');

const BASE = 'https://ws.audioscrobbler.com/2.0/';

async function fetchLastFm() {
  const key = process.env.LASTFM_API_KEY;
  const user = process.env.LASTFM_USERNAME;
  if (!key || !user) return null;
  try {
    const [recent, top, info] = await Promise.allSettled([
      axios.get(`${BASE}?method=user.getrecenttracks&user=${user}&api_key=${key}&format=json&limit=10`),
      axios.get(`${BASE}?method=user.gettoptracks&user=${user}&api_key=${key}&format=json&limit=5&period=7day`),
      axios.get(`${BASE}?method=user.getinfo&user=${user}&api_key=${key}&format=json`),
    ]);
    const recentTracks = recent.status === 'fulfilled'
      ? (recent.value.data.recenttracks?.track || []).map(t => ({
          name: t.name, artist: t.artist['#text'], album: t.album['#text'],
          url: t.url, nowPlaying: !!t['@attr']?.nowplaying,
          image: t.image?.find(i => i.size === 'medium')?.['#text'] || null,
          date: t.date?.uts ? parseInt(t.date.uts) : null,
        }))
      : [];
    const topTracks = top.status === 'fulfilled'
      ? (top.value.data.toptracks?.track || []).map(t => ({
          name: t.name, artist: t.artist.name, playcount: t.playcount, url: t.url,
        }))
      : [];
    const userInfo = info.status === 'fulfilled' ? info.value.data.user : null;
    return {
      recentTracks, topTracks,
      scrobbles: userInfo?.playcount || 0,
      username: userInfo?.name || user,
      avatar: userInfo?.image?.find(i => i.size === 'medium')?.['#text'] || null,
    };
  } catch (e) { console.error('Last.fm:', e.message); return null; }
}

module.exports = { fetchLastFm, isConfigured: () => !!(process.env.LASTFM_API_KEY && process.env.LASTFM_USERNAME) };
