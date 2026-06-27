require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const cron = require('node-cron');

const google = require('./integrations/google');
const spotify = require('./integrations/spotify');
const github = require('./integrations/github');
const discord = require('./integrations/discord');
const duolingo = require('./integrations/duolingo');
const weather = require('./integrations/weather');
const nasa = require('./integrations/nasa');
const news = require('./integrations/news');
const twitch = require('./integrations/twitch');
const steam = require('./integrations/steam');
const lastfm = require('./integrations/lastfm');
const notion = require('./integrations/notion');
const bible = require('./integrations/bible');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'dev-secret', resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ── CRON JOBS ────────────────────────────────────────
cron.schedule('*/5 * * * *', async () => {
  if (spotify.isConnected()) { try { await spotify.fetchNowPlaying(); } catch(e){} }
  if (twitch.isConnected()) { try { await twitch.fetchLiveStreams(); } catch(e){} }
});

cron.schedule('*/10 * * * *', async () => {
  if (google.isConnected()) { try { await Promise.all([google.fetchEmails(), google.fetchCalendar(), google.fetchYouTube()]); } catch(e){} }
  if (github.isConnected()) { try { await github.fetchData(); } catch(e){} }
  if (notion.isConnected()) { try { await notion.fetchPages(); } catch(e){} }
  if (news.isConfigured()) { try { await news.fetchNews(); } catch(e){} }
});

cron.schedule('*/30 * * * *', async () => {
  if (duolingo.isConfigured()) { try { await duolingo.fetchStreak(); } catch(e){} }
  if (steam.isConfigured()) { try { await steam.fetchSteam(); } catch(e){} }
  if (lastfm.isConfigured()) { try { await lastfm.fetchLastFm(); } catch(e){} }
  if (weather.isConfigured()) { try { await weather.fetchWeather(process.env.WEATHER_LAT||'40.7128', process.env.WEATHER_LON||'-74.0060'); } catch(e){} }
});

// Daily at midnight: Bible verse + NASA APOD
cron.schedule('0 0 * * *', async () => {
  try { await bible.fetchDailyVerse(); } catch(e){}
  try { await nasa.fetchAPOD(); } catch(e){}
});

discord.startBot();

async function initialLoad() {
  console.log('🚀 Initial data load...');
  await Promise.allSettled([
    google.isConnected() ? Promise.all([google.fetchEmails(), google.fetchCalendar(), google.fetchYouTube()]) : null,
    spotify.isConnected() ? spotify.fetchNowPlaying() : null,
    github.isConnected() ? github.fetchData() : null,
    duolingo.isConfigured() ? duolingo.fetchStreak() : null,
    twitch.isConnected() ? twitch.fetchLiveStreams() : null,
    notion.isConnected() ? notion.fetchPages() : null,
    news.isConfigured() ? news.fetchNews() : null,
    steam.isConfigured() ? steam.fetchSteam() : null,
    lastfm.isConfigured() ? lastfm.fetchLastFm() : null,
    weather.isConfigured() ? weather.fetchWeather(process.env.WEATHER_LAT||'40.7128', process.env.WEATHER_LON||'-74.0060') : null,
    bible.fetchDailyVerse(),
    nasa.fetchAPOD(),
  ].filter(Boolean));
  console.log('✅ Initial load complete');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n⚡ Command Center → http://localhost:${PORT}\n`);
  await initialLoad();
});
