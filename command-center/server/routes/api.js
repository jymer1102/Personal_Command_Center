const router = require('express').Router();
const db = require('../db');
const google = require('../integrations/google');
const spotify = require('../integrations/spotify');
const github = require('../integrations/github');
const discord = require('../integrations/discord');
const duolingo = require('../integrations/duolingo');
const weather = require('../integrations/weather');
const news = require('../integrations/news');
const twitch = require('../integrations/twitch');
const lastfm = require('../integrations/lastfm');
const bible = require('../integrations/bible');

router.get('/status', (req, res) => res.json({
  google: google.isConnected(),
  spotify: spotify.isConnected(),
  github: github.isConnected(),
  discord: discord.isConnected(),
  twitch: twitch.isConnected(),
  duolingo: duolingo.isConfigured(),
  weather: weather.isConfigured(),
  news: news.isConfigured(),
  lastfm: lastfm.isConfigured(),
}));

router.get('/dashboard', async (req, res) => {
  try {
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY done ASC, created_at DESC').all();
    const emails = db.prepare('SELECT * FROM emails ORDER BY date DESC LIMIT 25').all();
    const calendar = db.prepare('SELECT * FROM calendar_events ORDER BY start_time ASC').all();
    const github_items = db.prepare('SELECT * FROM github_items ORDER BY updated_at DESC LIMIT 20').all();
    const discord_msgs = discord.getCachedMessages();
    const spotify_state = db.prepare('SELECT * FROM spotify_state WHERE id=1').get();
    const youtube = db.prepare('SELECT * FROM youtube_items ORDER BY published_at DESC LIMIT 6').all();
    const duo = duolingo.getCached();
    const twitch_streams = db.prepare('SELECT * FROM twitch_streams ORDER BY viewer_count DESC').all();
    const news_items = db.prepare('SELECT * FROM news_items ORDER BY published_at DESC LIMIT 12').all();
    const bible_verse = db.prepare('SELECT * FROM bible_verse WHERE id=1').get();
    res.json({ tasks, emails, calendar, github_items, discord_msgs, spotify_state,
      youtube, duolingo: duo, twitch_streams, news_items, bible_verse });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/weather', async (req, res) => {
  try {
    const data = await weather.fetchWeather(
      req.query.lat || process.env.WEATHER_LAT,
      req.query.lon || process.env.WEATHER_LON,
      req.query.city
    );
    res.json(data || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/lastfm', async (req, res) => {
  try { res.json(await lastfm.fetchLastFm() || {}); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/refresh/:provider', async (req, res) => {
  const { provider } = req.params;
  try {
    let data;
    if (provider === 'google') {
      const [emails, calendar, youtube] = await Promise.all([google.fetchEmails(), google.fetchCalendar(), google.fetchYouTube()]);
      data = { emails, calendar, youtube };
    } else if (provider === 'spotify') { data = await spotify.fetchNowPlaying();
    } else if (provider === 'github') { data = await github.fetchData();
    } else if (provider === 'discord') { data = discord.getCachedMessages();
    } else if (provider === 'duolingo') { data = await duolingo.fetchStreak();
    } else if (provider === 'twitch') { data = await twitch.fetchLiveStreams();
    } else if (provider === 'news') { data = await news.fetchNews();
    } else if (provider === 'bible') { data = await bible.fetchDailyVerse();
    } else return res.status(400).json({ error: 'Unknown provider' });
    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/tasks', (req, res) => res.json(db.prepare('SELECT * FROM tasks ORDER BY done ASC, created_at DESC').all()));
router.post('/tasks', (req, res) => {
  const { title, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const { lastInsertRowid } = db.prepare('INSERT INTO tasks (title, due_date) VALUES (?,?)').run(title, due_date || null);
  res.json(db.prepare('SELECT * FROM tasks WHERE id=?').get(lastInsertRowid));
});
router.patch('/tasks/:id', (req, res) => {
  const { done, title } = req.body;
  if (done !== undefined) db.prepare('UPDATE tasks SET done=?,updated_at=unixepoch() WHERE id=?').run(done ? 1 : 0, req.params.id);
  if (title) db.prepare('UPDATE tasks SET title=?,updated_at=unixepoch() WHERE id=?').run(title, req.params.id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id));
});
router.delete('/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/emails/purge-marketing', async (req, res) => {
  const ids = db.prepare("SELECT id FROM emails WHERE label='marketing'").all().map(e => e.id);
  if (!ids.length) return res.json({ purged: 0 });
  const purged = await google.trashEmails(ids);
  res.json({ purged });
});

router.post('/spotify/:action', async (req, res) => {
  const { action } = req.params;
  if (!['play','pause','next','prev'].includes(action)) return res.status(400).json({ error: 'Invalid' });
  await spotify.control(action);
  setTimeout(async () => { await spotify.fetchNowPlaying(); }, 700);
  res.json({ ok: true });
});

module.exports = router;
