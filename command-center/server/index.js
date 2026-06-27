require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const cron = require('node-cron');

const google = require('./integrations/google');
const spotify = require('./integrations/spotify');
const github = require('./integrations/github');
const reddit = require('./integrations/reddit');
const duolingo = require('./integrations/duolingo');
const discord = require('./integrations/discord');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'dev-secret', resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));

// Serve the SPA
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ── BACKGROUND SYNC (cron) ───────────────────────────
// Every 5 min: Spotify now playing
cron.schedule('*/5 * * * *', async () => {
  if (spotify.isConnected()) { try { await spotify.fetchNowPlaying(); } catch (e) {} }
});

// Every 10 min: Gmail + Calendar + YouTube, GitHub, Reddit
cron.schedule('*/10 * * * *', async () => {
  if (google.isConnected()) {
    try { await Promise.all([google.fetchEmails(), google.fetchCalendar(), google.fetchYouTube()]); } catch (e) {}
  }
  if (github.isConnected()) { try { await github.fetchData(); } catch (e) {} }
  if (reddit.isConnected()) { try { await reddit.fetchData(); } catch (e) {} }
});

// Every 30 min: Duolingo streak
cron.schedule('*/30 * * * *', async () => {
  if (duolingo.isConfigured()) { try { await duolingo.fetchStreak(); } catch (e) {} }
});

// Initial data load on startup
async function initialLoad() {
  console.log('🚀 Initial data load...');
  const tasks = [
    google.isConnected() ? Promise.all([google.fetchEmails(), google.fetchCalendar(), google.fetchYouTube()]) : null,
    spotify.isConnected() ? spotify.fetchNowPlaying() : null,
    github.isConnected() ? github.fetchData() : null,
    reddit.isConnected() ? reddit.fetchData() : null,
    duolingo.isConfigured() ? duolingo.fetchStreak() : null,
  ].filter(Boolean);
  await Promise.allSettled(tasks);
  console.log('✅ Initial load complete');
}

// Start Discord bot if token is set
discord.startBot();

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n⚡ Command Center running → http://localhost:${PORT}\n`);
  await initialLoad();
});
