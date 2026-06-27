const axios = require('axios');
const db = require('../db');

const UA = process.env.REDDIT_USER_AGENT || 'CommandCenter/2.0';

function getAuthUrl() {
  return `https://www.reddit.com/api/v1/authorize?${new URLSearchParams({
    client_id: process.env.REDDIT_CLIENT_ID,
    response_type: 'code', state: 'cc',
    redirect_uri: process.env.REDDIT_REDIRECT_URI,
    duration: 'permanent',
    scope: 'read identity mysubreddits privatemessages',
  })}`;
}

async function handleCallback(code) {
  const creds = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
  const { data } = await axios.post('https://www.reddit.com/api/v1/access_token',
    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.REDDIT_REDIRECT_URI }),
    { headers: { Authorization: `Basic ${creds}`, 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } });
  const { data: u } = await axios.get('https://oauth.reddit.com/api/v1/me',
    { headers: { Authorization: `Bearer ${data.access_token}`, 'User-Agent': UA } });
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  db.prepare(`INSERT OR REPLACE INTO tokens VALUES ('reddit',?,?,?,?,?,unixepoch())`)
    .run(data.access_token, data.refresh_token, expiresAt, data.scope, JSON.stringify(u));
  return u;
}

async function getToken() {
  const row = db.prepare('SELECT * FROM tokens WHERE provider=?').get('reddit');
  if (!row) return null;
  if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000) + 60) {
    const creds = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
    try {
      const { data } = await axios.post('https://www.reddit.com/api/v1/access_token',
        new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refresh_token }),
        { headers: { Authorization: `Basic ${creds}`, 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } });
      const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
      db.prepare(`UPDATE tokens SET access_token=?,expires_at=?,updated_at=unixepoch() WHERE provider='reddit'`).run(data.access_token, expiresAt);
      return data.access_token;
    } catch (e) { console.error('Reddit refresh:', e.message); return null; }
  }
  return row.access_token;
}

async function fetchData() {
  const token = await getToken(); if (!token) return {};
  const h = { Authorization: `Bearer ${token}`, 'User-Agent': UA };
  const [feed, msgs] = await Promise.allSettled([
    axios.get('https://oauth.reddit.com/r/all/hot?limit=10', { headers: h }),
    axios.get('https://oauth.reddit.com/message/unread?limit=10', { headers: h }),
  ]);
  db.prepare('DELETE FROM reddit_items').run();
  const ins = db.prepare(`INSERT OR REPLACE INTO reddit_items VALUES (?,?,?,?,?,?,?,?,?,unixepoch())`);
  const out = { feed: [], messages: [] };
  if (feed.status === 'fulfilled') {
    out.feed = (feed.value.data.data?.children || []).map(({ data: x }) => {
      const o = { id: x.id, type: 'post', title: x.title, subreddit: x.subreddit,
        url: `https://reddit.com${x.permalink}`, score: x.score,
        num_comments: x.num_comments, author: x.author,
        created_at: Math.floor(x.created_utc) };
      ins.run(o.id,o.type,o.title,o.subreddit,o.url,o.score,o.num_comments,o.author,o.created_at); return o;
    });
  }
  if (msgs.status === 'fulfilled') {
    out.messages = (msgs.value.data.data?.children || []).map(({ data: x }) => {
      const o = { id: x.id, type: 'message', title: x.subject, subreddit: x.subreddit || 'DM',
        url: `https://reddit.com/message/inbox`, score: 0, num_comments: 0,
        author: x.author, created_at: Math.floor(x.created_utc) };
      ins.run(o.id,o.type,o.title,o.subreddit,o.url,o.score,o.num_comments,o.author,o.created_at); return o;
    });
  }
  return out;
}

module.exports = { getAuthUrl, handleCallback, fetchData,
  isConnected: () => !!db.prepare('SELECT 1 FROM tokens WHERE provider=?').get('reddit') };
