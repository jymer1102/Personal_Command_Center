const axios = require('axios');
const db = require('../db');

const BASE = 'https://api.spotify.com/v1';

function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    scope: 'user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played',
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

async function handleCallback(code) {
  const creds = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const { data } = await axios.post('https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.SPOTIFY_REDIRECT_URI }),
    { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const { data: user } = await axios.get(`${BASE}/me`, { headers: { Authorization: `Bearer ${data.access_token}` } });
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  db.prepare(`INSERT OR REPLACE INTO tokens VALUES ('spotify',?,?,?,?,?,unixepoch())`)
    .run(data.access_token, data.refresh_token, expiresAt, data.scope, JSON.stringify(user));
  return user;
}

async function getToken() {
  const row = db.prepare('SELECT * FROM tokens WHERE provider=?').get('spotify');
  if (!row) return null;
  if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000) + 60) {
    const creds = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    try {
      const { data } = await axios.post('https://accounts.spotify.com/api/token',
        new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refresh_token }),
        { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
      db.prepare(`UPDATE tokens SET access_token=?,expires_at=?,updated_at=unixepoch() WHERE provider='spotify'`)
        .run(data.access_token, expiresAt);
      return data.access_token;
    } catch (e) { console.error('Spotify refresh:', e.message); return null; }
  }
  return row.access_token;
}

async function fetchNowPlaying() {
  const token = await getToken(); if (!token) return null;
  try {
    const { data, status } = await axios.get(`${BASE}/me/player`, { headers: { Authorization: `Bearer ${token}` } });
    if (status === 204 || !data) { db.prepare(`INSERT OR REPLACE INTO spotify_state (id,is_playing) VALUES (1,0)`).run(); return null; }
    const track = data.item;
    const state = {
      is_playing: data.is_playing ? 1 : 0,
      track_name: track?.name || null,
      artist: track?.artists?.map(a => a.name).join(', ') || null,
      album: track?.album?.name || null,
      album_art: track?.album?.images?.[0]?.url || null,
      track_url: track?.external_urls?.spotify || null,
      progress_ms: data.progress_ms || 0,
      duration_ms: track?.duration_ms || 0,
      device: data.device?.name || null,
    };
    db.prepare(`INSERT OR REPLACE INTO spotify_state (id,is_playing,track_name,artist,album,album_art,track_url,progress_ms,duration_ms,device,updated_at)
      VALUES (1,?,?,?,?,?,?,?,?,?,unixepoch())`)
      .run(state.is_playing,state.track_name,state.artist,state.album,state.album_art,state.track_url,state.progress_ms,state.duration_ms,state.device);
    return state;
  } catch (e) { console.error('Spotify now playing:', e.message); return null; }
}

async function control(action) {
  const token = await getToken(); if (!token) return;
  const map = { play: ['PUT','https://api.spotify.com/v1/me/player/play'], pause: ['PUT','https://api.spotify.com/v1/me/player/pause'],
    next: ['POST','https://api.spotify.com/v1/me/player/next'], prev: ['POST','https://api.spotify.com/v1/me/player/previous'] };
  if (!map[action]) return;
  const [method, url] = map[action];
  await axios({ method, url, headers: { Authorization: `Bearer ${token}` } });
}

module.exports = { getAuthUrl, handleCallback, fetchNowPlaying, control,
  isConnected: () => !!db.prepare('SELECT 1 FROM tokens WHERE provider=?').get('spotify') };
