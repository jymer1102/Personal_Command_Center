# Personal Command Center

**Plan. Organize. Execute.**

A self-hosted personal dashboard that connects your digital life into one place. Runs on [Render](https://render.com) for free, deployed straight from GitHub.

![Personal Command Center](assets/banner.png)

---

## What's included

| Panel | What you get | Setup required |
|-------|-------------|----------------|
| **Daily Agenda** | Task list with progress bar, persists across sessions | None |
| **Daily Bible Verse** | Auto-rotating KJV verse every day | None |
| **Gmail** | Live inbox, email labels, one-click purge of marketing emails | Google OAuth |
| **Google Calendar** | Next 7 days of events with Google Meet links | Google OAuth |
| **YouTube** | Your channel's latest uploads | Google OAuth |
| **Spotify** | Now playing, album art, play/pause/skip controls | Spotify OAuth |
| **Last.fm** | Recent scrobbles, total play count | API key + username |
| **Weather** | Current conditions + hourly forecast | OpenWeatherMap API key |
| **GitHub** | Open PRs, unread notifications, recent repos | GitHub OAuth |
| **Discord** | Real-time mentions + DMs via bot | Discord OAuth + Bot |
| **Twitch** | Live streams from channels you follow | Twitch OAuth |
| **NewsAPI** | Top headlines filtered by your topics | NewsAPI key |
| **Duolingo** | Streak, XP progress, languages | Username only |

---

## Deploy to Render (no terminal needed)

1. Fork or upload this repo to GitHub
2. Go to [render.com](https://render.com) → sign in with GitHub
3. **New → Web Service** → connect your repo
4. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server/index.js`
   - **Instance Type:** Free
5. Add your environment variables (see below)
6. Click **Deploy**

---

## Environment variables

Add these in Render under **Environment**. Only add the ones you're using — missing ones just show empty placeholders.

```
PORT=3000
SESSION_SECRET=any-long-random-string-at-least-32-characters
NODE_ENV=production
```

### Google (Gmail + Calendar + YouTube)
> [console.cloud.google.com](https://console.cloud.google.com) → new project → enable Gmail API, Google Calendar API, YouTube Data API v3, People API → OAuth 2.0 credentials → Web application
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://YOUR-APP.onrender.com/auth/google/callback
YOUTUBE_CHANNEL_ID=
```

### Spotify
> [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → Create app → Web API
```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=https://YOUR-APP.onrender.com/auth/spotify/callback
```

### GitHub
> [github.com/settings/developers](https://github.com/settings/developers) → New OAuth App
```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=https://YOUR-APP.onrender.com/auth/github/callback
```

### Discord
> [discord.com/developers/applications](https://discord.com/developers/applications) → New App → OAuth2 tab for client credentials, Bot tab for token. Enable Message Content Intent + Server Members Intent.
```
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_REDIRECT_URI=https://YOUR-APP.onrender.com/auth/discord/callback
```

### Twitch
> [dev.twitch.tv/console](https://dev.twitch.tv/console) → Register Your Application → Website Integration
```
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_REDIRECT_URI=https://YOUR-APP.onrender.com/auth/twitch/callback
```

### Weather
> [openweathermap.org](https://openweathermap.org) → free signup → API Keys tab. Find lat/lon at openweathermap.org/find
```
OPENWEATHER_API_KEY=
WEATHER_LAT=37.2090
WEATHER_LON=-93.2923
```

### Last.fm
> [last.fm/api/account/create](https://www.last.fm/api/account/create) → free API key
```
LASTFM_API_KEY=
LASTFM_USERNAME=
```

### NewsAPI
> [newsapi.org](https://newsapi.org) → Get API Key (free personal tier)
```
NEWS_API_KEY=
NEWS_TOPICS=technology,science
```

### Duolingo
> No account or key needed — just your username
```
DUOLINGO_USERNAME=
```

---

## File structure

```
/
├── server/
│   ├── index.js              # Express app + cron jobs
│   ├── db.js                 # SQLite schema
│   ├── integrations/
│   │   ├── google.js         # Gmail, Calendar, YouTube
│   │   ├── spotify.js        # Now playing + controls
│   │   ├── github.js         # PRs, notifications, repos
│   │   ├── discord.js        # OAuth + real-time bot
│   │   ├── twitch.js         # Live streams
│   │   ├── weather.js        # OpenWeatherMap
│   │   ├── lastfm.js         # Music scrobbles
│   │   ├── news.js           # NewsAPI headlines
│   │   ├── duolingo.js       # Streak + XP
│   │   └── bible.js          # Daily verse (no key needed)
│   └── routes/
│       ├── api.js            # /api/* data endpoints
│       └── auth.js           # /auth/* OAuth callbacks
├── public/
│   ├── index.html
│   ├── css/app.css
│   ├── js/app.js
│   └── assets/
│       ├── logo.png          # Favicon + app icon
│       └── banner.png        # Social share image
├── .env.example
├── .gitignore
└── package.json
```

---

## How it works

- **Backend:** Node.js + Express, SQLite via better-sqlite3 for local caching
- **Auth:** Standard OAuth 2.0 — tokens stored in SQLite, never leave your server
- **Auto-sync:** Cron jobs refresh data in the background (Spotify every 5 min, Gmail/Calendar/GitHub/News every 10 min, Duolingo/Weather/Last.fm every 30 min, Bible verse daily)
- **Discord:** Bot stays connected via WebSocket and caches mentions + DMs as they arrive
- **Responsive:** Works on desktop, tablet, and mobile

---

## Troubleshooting

**Build fails on Render** — make sure `package.json` has `"node": "18.x"` in engines. Render defaults to Node 26 which breaks better-sqlite3.

**redirect_uri_mismatch** — the redirect URI in your env vars must exactly match what you entered in the developer console, including `https://`.

**Nothing loading after deploy** — check Render logs. Most likely a missing env var causing a crash on startup.

**Discord bot not seeing messages** — go to your app in the Discord developer portal → Bot tab → enable Message Content Intent and Server Members Intent.

**Duolingo shows nothing** — your Duolingo profile must be set to public in the app settings.

**Render free tier cold starts** — the app sleeps after 15 min of inactivity. First load after sleeping takes ~30 seconds. Use [UptimeRobot](https://uptimerobot.com) (free) to ping your URL every 5 minutes to keep it awake.
