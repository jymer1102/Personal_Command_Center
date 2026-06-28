const { google } = require('googleapis');
const db = require('../db');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/youtube.readonly',
];

function client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl() {
  return client().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
}

async function handleCallback(code) {
  const c = client();
  const { tokens } = await c.getToken(code);
  c.setCredentials(tokens);
  const { data: u } = await google.oauth2({ version: 'v2', auth: c }).userinfo.get();
  db.prepare(`INSERT OR REPLACE INTO tokens VALUES ('google',?,?,?,?,?,unixepoch())`)
    .run(tokens.access_token, tokens.refresh_token || null,
         tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
         tokens.scope || null, JSON.stringify(u));
  return u;
}

function authedClient() {
  const row = db.prepare('SELECT * FROM tokens WHERE provider=?').get('google');
  if (!row) return null;
  const c = client();
  c.setCredentials({ access_token: row.access_token, refresh_token: row.refresh_token,
    expiry_date: row.expires_at ? row.expires_at * 1000 : undefined });
  c.on('tokens', t => {
    if (t.access_token)
      db.prepare(`UPDATE tokens SET access_token=?,expires_at=?,updated_at=unixepoch() WHERE provider='google'`)
        .run(t.access_token, t.expiry_date ? Math.floor(t.expiry_date / 1000) : null);
  });
  return c;
}

async function fetchEmails() {
  const c = authedClient(); if (!c) return [];
  const gmail = google.gmail({ version: 'v1', auth: c });
  const { data } = await gmail.users.messages.list({ userId: 'me', maxResults: 25, q: 'in:inbox' });
  if (!data.messages) return [];
  const emails = [];
  for (const msg of data.messages.slice(0, 20)) {
    const { data: full } = await gmail.users.messages.get({
      userId: 'me', id: msg.id, format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });
    const h = full.payload?.headers || [];
    const get = n => (h.find(x => x.name === n) || {}).value || '';
    const fromRaw = get('From');
    const m = fromRaw.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
    const labels = full.labelIds || [];
    let label = 'general';
    if (labels.includes('IMPORTANT')) label = 'important';
    if (labels.includes('CATEGORY_PROMOTIONS')) label = 'marketing';
    if (labels.includes('CATEGORY_SOCIAL')) label = 'social';
    if (labels.includes('CATEGORY_UPDATES')) label = 'updates';
    const e = { id: msg.id, from_name: m ? m[1].trim() : fromRaw,
      from_email: m ? m[2].trim() : fromRaw, subject: get('Subject') || '(no subject)',
      snippet: full.snippet || '', label, is_unread: labels.includes('UNREAD') ? 1 : 0,
      date: full.internalDate ? Math.floor(+full.internalDate / 1000) : 0 };
    db.prepare(`INSERT OR REPLACE INTO emails VALUES (?,?,?,?,?,?,?,?,unixepoch())`)
      .run(e.id,e.from_name,e.from_email,e.subject,e.snippet,e.label,e.is_unread,e.date);
    emails.push(e);
  }
  return emails;
}

async function trashEmails(ids) {
  const c = authedClient(); if (!c) return 0;
  const gmail = google.gmail({ version: 'v1', auth: c });
  let count = 0;
  for (const id of ids) {
    try { await gmail.users.messages.trash({ userId: 'me', id });
      db.prepare('DELETE FROM emails WHERE id=?').run(id); count++; }
    catch (e) { console.error('trash:', e.message); }
  }
  return count;
}

async function fetchCalendar() {
  const c = authedClient(); if (!c) return [];
  const cal = google.calendar({ version: 'v3', auth: c });
  const now = new Date();
  const { data } = await cal.events.list({
    calendarId: 'primary', timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + 7 * 86400000).toISOString(),
    singleEvents: true, orderBy: 'startTime', maxResults: 20,
  });
  db.prepare('DELETE FROM calendar_events').run();
  return (data.items || []).map(e => {
    const meetLink = (e.conferenceData?.entryPoints || []).find(x => x.entryPointType === 'video')?.uri || null;
    const allDay = !e.start?.dateTime ? 1 : 0;
    const obj = { id: e.id, title: e.summary || 'Untitled', start_time: e.start?.dateTime || e.start?.date,
      end_time: e.end?.dateTime || e.end?.date, location: e.location || null, meet_link: meetLink, all_day: allDay };
    db.prepare(`INSERT OR REPLACE INTO calendar_events VALUES (?,?,?,?,?,?,?,unixepoch())`)
      .run(obj.id,obj.title,obj.start_time,obj.end_time,obj.location,obj.meet_link,obj.all_day);
    return obj;
  });
}

async function fetchYouTube() {
  const c = authedClient(); if (!c) return [];
  const yt = google.youtube({ version: 'v3', auth: c });
  try {
    const channelId = process.env.YOUTUBE_CHANNEL_ID;
    const params = channelId
      ? { part: 'snippet,statistics', id: channelId }
      : { part: 'snippet,statistics', mine: true };
    const { data: chData } = await yt.channels.list(params);
    const ch = chData.items?.[0];
    if (!ch) return [];
    const { data: vidData } = await yt.search.list({
      part: 'snippet', channelId: ch.id, order: 'date', maxResults: 6, type: 'video',
    });
    db.prepare('DELETE FROM youtube_items').run();
    return (vidData.items || []).map(v => {
      const obj = { id: v.id.videoId, title: v.snippet.title, channel: v.snippet.channelTitle,
        thumbnail: v.snippet.thumbnails?.medium?.url || null,
        url: `https://youtube.com/watch?v=${v.id.videoId}`,
        view_count: 0, published_at: Math.floor(new Date(v.snippet.publishedAt).getTime() / 1000) };
      db.prepare(`INSERT OR REPLACE INTO youtube_items VALUES (?,?,?,?,?,?,?,unixepoch())`)
        .run(obj.id,obj.title,obj.channel,obj.thumbnail,obj.url,obj.view_count,obj.published_at);
      return obj;
    });
  } catch (e) { console.error('YouTube:', e.message); return []; }
}

module.exports = { getAuthUrl, handleCallback, fetchEmails, fetchCalendar, fetchYouTube, trashEmails,
  isConnected: () => !!db.prepare('SELECT 1 FROM tokens WHERE provider=?').get('google') };
