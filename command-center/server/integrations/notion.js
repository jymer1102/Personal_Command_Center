const axios = require('axios');
const db = require('../db');

const BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function getAuthUrl() {
  return `https://api.notion.com/v1/oauth/authorize?${new URLSearchParams({
    client_id: process.env.NOTION_CLIENT_ID,
    response_type: 'code',
    owner: 'user',
    redirect_uri: process.env.NOTION_REDIRECT_URI,
  })}`;
}

async function handleCallback(code) {
  const creds = Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64');
  const { data } = await axios.post(`${BASE}/oauth/token`,
    { grant_type: 'authorization_code', code, redirect_uri: process.env.NOTION_REDIRECT_URI },
    { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json', 'Notion-Version': NOTION_VERSION } }
  );
  db.prepare(`INSERT OR REPLACE INTO tokens VALUES ('notion',?,NULL,NULL,NULL,?,unixepoch())`)
    .run(data.access_token, JSON.stringify(data.owner?.user || {}));
  return data.owner?.user;
}

function headers() {
  const row = db.prepare('SELECT access_token FROM tokens WHERE provider=?').get('notion');
  if (!row) return null;
  return { Authorization: `Bearer ${row.access_token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' };
}

async function fetchPages() {
  const h = headers(); if (!h) return [];
  try {
    const { data } = await axios.post(`${BASE}/search`,
      { filter: { value: 'page', property: 'object' }, sort: { direction: 'descending', timestamp: 'last_edited_time' }, page_size: 10 },
      { headers: h }
    );
    return (data.results || []).map(p => ({
      id: p.id,
      title: p.properties?.title?.title?.[0]?.plain_text || p.properties?.Name?.title?.[0]?.plain_text || 'Untitled',
      url: p.url,
      last_edited: p.last_edited_time,
      icon: p.icon?.emoji || null,
    }));
  } catch (e) { console.error('Notion:', e.message); return []; }
}

module.exports = { getAuthUrl, handleCallback, fetchPages,
  isConnected: () => !!db.prepare('SELECT 1 FROM tokens WHERE provider=?').get('notion') };
