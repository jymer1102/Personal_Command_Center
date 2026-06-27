const router = require('express').Router();
const db = require('../db');
const google = require('../integrations/google');
const spotify = require('../integrations/spotify');
const github = require('../integrations/github');
const discord = require('../integrations/discord');
const reddit = require('../integrations/reddit');
const duolingo = require('../integrations/duolingo');

router.get('/status', (req, res) => {
  res.json({
    google: google.isConnected(), spotify: spotify.isConnected(),
    github: github.isConnected(), discord: discord.isConnected(),
    reddit: reddit.isConnected(), duolingo: duolingo.isConfigured(),
  });
});

router.get('/dashboard', async (req, res) => {
  try {
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY done ASC, created_at DESC').all();
    const emails = db.prepare('SELECT * FROM emails ORDER BY date DESC LIMIT 25').all();
    const calendar = db.prepare('SELECT * FROM calendar_events ORDER BY start_time ASC').all();
    const github_items = db.prepare('SELECT * FROM github_items ORDER BY updated_at DESC LIMIT 20').all();
    const discord_msgs = discord.getCachedMessages();
    const reddit_items = db.prepare('SELECT * FROM reddit_items ORDER BY created_at DESC LIMIT 15').all();
    const spotify_state = db.prepare('SELECT * FROM spotify_state WHERE id=1').get();
    const youtube = db.prepare('SELECT * FROM youtube_items ORDER BY published_at DESC LIMIT 6').all();
    const duo = duolingo.getCached();
    res.json({ tasks, emails, calendar, github_items, discord_msgs, reddit_items, spotify_state, youtube, duolingo: duo });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    } else if (provider === 'reddit') { data = await reddit.fetchData();
    } else if (provider === 'duolingo') { data = await duolingo.fetchStreak();
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
  if (!['play','pause','next','prev'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  await spotify.control(action);
  setTimeout(async () => { await spotify.fetchNowPlaying(); }, 600);
  res.json({ ok: true });
});

module.exports = router;
