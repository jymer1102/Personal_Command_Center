const axios = require('axios');
const db = require('../db');

function getAuthUrl() {
  return `https://id.twitch.tv/oauth2/authorize?${new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    redirect_uri: process.env.TWITCH_REDIRECT_URI,
    response_type: 'code',
    scope: 'user:read:follows',
  })}`;
}

async function handleCallback(code) {
  const { data } = await axios.post('https://id.twitch.tv/oauth2/token', new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID, client_secret: process.env.TWITCH_CLIENT_SECRET,
    code, grant_type: 'authorization_code', redirect_uri: process.env.TWITCH_REDIRECT_URI,
  }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const { data: u } = await axios.get('https://api.twitch.tv/helix/users', {
    headers: { Authorization: `Bearer ${data.access_token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID } });
  const user = u.data[0];
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  db.prepare(`INSERT OR REPLACE INTO tokens VALUES ('twitch',?,?,?,?,?,unixepoch())`)
    .run(data.access_token, data.refresh_token, expiresAt, data.scope, JSON.stringify(user));
  return user;
}

async function getToken() {
  const row = db.prepare('SELECT * FROM tokens WHERE provider=?').get('twitch');
  if (!row) return null;
  if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000) + 60) {
    try {
      const { data } = await axios.post('https://id.twitch.tv/oauth2/token', new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID, client_secret: process.env.TWITCH_CLIENT_SECRET,
        refresh_token: row.refresh_token, grant_type: 'refresh_token',
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
      db.prepare(`UPDATE tokens SET access_token=?,expires_at=?,updated_at=unixepoch() WHERE provider='twitch'`).run(data.access_token, expiresAt);
      return data.access_token;
    } catch (e) { console.error('Twitch refresh:', e.message); return null; }
  }
  return row.access_token;
}

async function fetchLiveStreams() {
  const token = await getToken(); if (!token) return [];
  const userRow = db.prepare('SELECT user_info FROM tokens WHERE provider=?').get('twitch');
  if (!userRow) return [];
  const user = JSON.parse(userRow.user_info);
  const h = { Authorization: `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID };
  try {
    const { data: follows } = await axios.get(`https://api.twitch.tv/helix/channels/followed?user_id=${user.id}&first=20`, { headers: h });
    if (!follows.data?.length) return [];
    const ids = follows.data.map(f => `user_id=${f.broadcaster_id}`).join('&');
    const { data: streams } = await axios.get(`https://api.twitch.tv/helix/streams?${ids}&first=20`, { headers: h });
    db.prepare('DELETE FROM twitch_streams').run();
    const ins = db.prepare(`INSERT OR REPLACE INTO twitch_streams (user_login,user_name,game_name,title,viewer_count,thumbnail,url,started_at,cached_at) VALUES (?,?,?,?,?,?,?,?,unixepoch())`);
    return (streams.data || []).map(s => {
      const obj = {
        user_login: s.user_login, user_name: s.user_name, game_name: s.game_name,
        title: s.title, viewer_count: s.viewer_count,
        thumbnail: s.thumbnail_url?.replace('{width}','320').replace('{height}','180'),
        url: `https://twitch.tv/${s.user_login}`, started_at: s.started_at,
      };
      ins.run(obj.user_login,obj.user_name,obj.game_name,obj.title,obj.viewer_count,obj.thumbnail,obj.url,obj.started_at);
      return obj;
    });
  } catch (e) { console.error('Twitch streams:', e.message); return []; }
}

module.exports = { getAuthUrl, handleCallback, fetchLiveStreams,
  isConnected: () => !!db.prepare('SELECT 1 FROM tokens WHERE provider=?').get('twitch') };
