const axios = require('axios');
const db = require('../db');

function getAuthUrl() {
  return `https://github.com/login/oauth/authorize?${new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
    scope: 'repo notifications read:user',
  })}`;
}

async function handleCallback(code) {
  const { data } = await axios.post('https://github.com/login/oauth/access_token',
    { client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET,
      code, redirect_uri: process.env.GITHUB_REDIRECT_URI },
    { headers: { Accept: 'application/json' } });
  if (data.error) throw new Error(data.error_description);
  const { data: u } = await axios.get('https://api.github.com/user',
    { headers: { Authorization: `Bearer ${data.access_token}`, 'User-Agent': 'CommandCenter/2.0' } });
  db.prepare(`INSERT OR REPLACE INTO tokens VALUES ('github',?,NULL,NULL,?,?,unixepoch())`)
    .run(data.access_token, data.scope, JSON.stringify(u));
  return u;
}

function headers() {
  const row = db.prepare('SELECT access_token FROM tokens WHERE provider=?').get('github');
  if (!row) return null;
  return { Authorization: `Bearer ${row.access_token}`, 'User-Agent': 'CommandCenter/2.0' };
}

async function fetchData() {
  const h = headers(); if (!h) return {};
  const [prs, notifs, repos] = await Promise.allSettled([
    axios.get('https://api.github.com/search/issues?q=is:pr+is:open+author:@me&per_page=10', { headers: h }),
    axios.get('https://api.github.com/notifications?per_page=20&all=false', { headers: h }),
    axios.get('https://api.github.com/user/repos?sort=updated&per_page=6', { headers: h }),
  ]);
  db.prepare('DELETE FROM github_items').run();
  const ins = db.prepare(`INSERT OR REPLACE INTO github_items VALUES (?,?,?,?,?,?,?,unixepoch())`);
  const out = { prs: [], notifications: [], repos: [] };
  if (prs.status === 'fulfilled') {
    out.prs = (prs.value.data.items || []).map(x => {
      const o = { id: String(x.id), type: 'pr', title: x.title,
        repo: x.repository_url?.split('/').slice(-2).join('/') || '',
        url: x.html_url, state: x.state, updated_at: Math.floor(new Date(x.updated_at).getTime()/1000) };
      ins.run(o.id,o.type,o.title,o.repo,o.url,o.state,o.updated_at); return o;
    });
  }
  if (notifs.status === 'fulfilled') {
    out.notifications = (notifs.value.data || []).map(x => {
      const o = { id: String(x.id), type: 'notification', title: x.subject?.title || '',
        repo: x.repository?.full_name || '', url: x.subject?.url || '',
        state: x.reason, updated_at: Math.floor(new Date(x.updated_at).getTime()/1000) };
      ins.run(o.id,o.type,o.title,o.repo,o.url,o.state,o.updated_at); return o;
    });
  }
  if (repos.status === 'fulfilled') {
    out.repos = (repos.value.data || []).map(x => {
      const o = { id: String(x.id), type: 'repo', title: x.name, repo: x.full_name,
        url: x.html_url, state: x.private ? 'private' : 'public',
        updated_at: Math.floor(new Date(x.updated_at).getTime()/1000) };
      ins.run(o.id,o.type,o.title,o.repo,o.url,o.state,o.updated_at); return o;
    });
  }
  return out;
}

module.exports = { getAuthUrl, handleCallback, fetchData,
  isConnected: () => !!db.prepare('SELECT 1 FROM tokens WHERE provider=?').get('github') };
