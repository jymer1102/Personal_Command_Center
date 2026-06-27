# ⌘ Personal Command Center

A real, self-hosted personal dashboard that connects to Gmail, Google Calendar, Spotify, GitHub, Discord, Reddit, YouTube, and Duolingo. Runs locally on your machine. No subscriptions, no cloud costs — just Node.js and your own API keys.

---

## What it does

| Service | What you get |
|---------|-------------|
| **Gmail** | Live inbox, labels, purge marketing emails (actually trashes them in Gmail) |
| **Google Calendar** | Next 7 days of events, Google Meet links |
| **YouTube** | Your channel's latest uploads |
| **Spotify** | Now playing, play/pause/skip controls, progress bar |
| **GitHub** | Open PRs, unread notifications, recent repos |
| **Discord** | Real-time mentions + DMs via a bot you add to your server |
| **Reddit** | Hot feed from your subscribed subreddits, unread messages |
| **Duolingo** | Streak, today's XP, goal progress (no login needed) |
| **Tasks** | Personal agenda with progress bar, persisted in SQLite |

---

## Prerequisites

- **Node.js 18+** — https://nodejs.org
- **npm** (comes with Node)
- A terminal

---

## Setup (takes about 20 minutes total)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/command-center.git
cd command-center
npm install
```

### 2. Create your .env file

```bash
cp .env.example .env
```

Then open `.env` and fill in each value. Instructions for each service are below.

---

## Getting your API keys

### 🔵 Google (Gmail + Calendar + YouTube)

1. Go to https://console.cloud.google.com
2. Click **"Select a project"** → **"New Project"** → name it "Command Center" → Create
3. In the left sidebar: **APIs & Services → Library**
4. Search and **Enable** each of these:
   - Gmail API
   - Google Calendar API
   - YouTube Data API v3
   - Google People API
5. Go to **APIs & Services → OAuth consent screen**
   - User Type: **External** → Create
   - App name: Command Center, your email, save
   - Scopes: click "Add or remove scopes", add these manually:
     - `../auth/gmail.modify`
     - `../auth/calendar.readonly`
     - `../auth/youtube.readonly`
     - `../auth/userinfo.email`
     - `../auth/userinfo.profile`
   - Test users: add your Google email → Save
6. Go to **Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
   - Create → copy **Client ID** and **Client Secret** into `.env`

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

For YouTube, go to your YouTube channel → click your avatar → **Your channel** → copy the channel ID from the URL (`/channel/UCxxxxxxxx`):

```env
YOUTUBE_CHANNEL_ID=UCxxxxxxxx
```

---

### 🟢 Spotify

1. Go to https://developer.spotify.com/dashboard
2. **Create app**
   - App name: Command Center
   - Redirect URI: `http://localhost:3000/auth/spotify/callback`
   - Which API: Web API → Save
3. Click your app → **Settings** → copy Client ID and Client Secret

```env
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
```

---

### ⚫ GitHub

1. Go to https://github.com/settings/developers
2. **New OAuth App**
   - Application name: Command Center
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/auth/github/callback`
   - Register application
3. Copy **Client ID** → Generate a new client secret → copy it

```env
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

---

### 🟣 Discord

Discord needs two things: an OAuth app (to identify you) and a bot (to read messages in real time).

**OAuth App:**
1. Go to https://discord.com/developers/applications → **New Application** → "Command Center"
2. **OAuth2** tab → Redirects → Add `http://localhost:3000/auth/discord/callback`
3. Copy **Client ID** and **Client Secret**

**Bot:**
1. **Bot** tab → **Add Bot** → Yes
2. Scroll down to **Privileged Gateway Intents** → enable:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
3. Click **Reset Token** → copy the bot token
4. To invite the bot to your server: go to **OAuth2 → URL Generator**
   - Scopes: `bot`
   - Bot permissions: `Read Messages/View Channels`, `Read Message History`
   - Copy the generated URL → open in browser → add to your server

```env
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
DISCORD_BOT_TOKEN=your-bot-token
```

---

### 🟠 Reddit

1. Go to https://www.reddit.com/prefs/apps (must be logged in)
2. Scroll to bottom → **"create another app..."**
   - Name: Command Center
   - Type: **web app**
   - Redirect URI: `http://localhost:3000/auth/reddit/callback`
   - Create app
3. Copy the **client id** (the string under "web app") and **secret**

```env
REDDIT_CLIENT_ID=your-client-id
REDDIT_CLIENT_SECRET=your-client-secret
REDDIT_USER_AGENT=CommandCenter/2.0 (by /u/YOUR_REDDIT_USERNAME)
```

---

### 🟡 Duolingo

No API key needed. Just your username:

```env
DUOLINGO_USERNAME=your_duolingo_username
```

---

### SESSION_SECRET

Generate a random string (any password manager works, or run this in your terminal):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into:
```env
SESSION_SECRET=the-output-from-above
```

---

## Run it

```bash
npm run dev    # development (auto-restarts on changes)
# or
npm start      # production
```

Open http://localhost:3000 in your browser.

On first launch you'll see connect buttons for each service. Click them one by one — each will open the OAuth consent screen, you approve, and it redirects back.

---

## How it works

- **Backend:** Express.js server with SQLite (via better-sqlite3) for local data storage
- **OAuth tokens** are stored in `data/center.db` — never leave your machine
- **Background sync:** cron jobs refresh data automatically (Spotify every 5 min, everything else every 10 min, Duolingo every 30 min)
- **Discord bot** stays connected via WebSocket and caches mentions/DMs as they arrive
- **No external services** — everything runs on localhost

---

## File structure

```
command-center/
├── server/
│   ├── index.js              # Express app + cron jobs
│   ├── db.js                 # SQLite schema
│   ├── integrations/
│   │   ├── google.js         # Gmail, Calendar, YouTube
│   │   ├── spotify.js        # Now playing + controls
│   │   ├── github.js         # PRs, notifications, repos
│   │   ├── discord.js        # OAuth + bot
│   │   ├── reddit.js         # Feed + messages
│   │   └── duolingo.js       # Streak (no auth)
│   └── routes/
│       ├── api.js            # /api/* endpoints
│       └── auth.js           # /auth/* OAuth callbacks
├── public/
│   ├── index.html
│   ├── css/app.css
│   └── js/app.js
├── data/                     # SQLite DB lives here (git-ignored)
├── .env.example              # Template — copy to .env
├── .gitignore
└── package.json
```

---

## Pushing to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/command-center.git
git push -u origin main
```

The `.gitignore` already excludes `.env` and `data/` so your tokens and database are never uploaded.

---

## Troubleshooting

**"redirect_uri_mismatch" from Google/Spotify/etc.**
→ The redirect URI in your `.env` must exactly match what you entered in the developer console, including `http://` vs `https://`.

**Discord bot not receiving messages**
→ Make sure you enabled "Message Content Intent" in the Bot settings page on Discord's developer portal.

**Duolingo shows nothing**
→ Your Duolingo profile must be public. Check Settings → Privacy in the Duolingo app.

**Gmail shows old data**
→ Click the ↻ button on the Gmail card, or wait for the 10-minute sync.

**Port 3000 already in use**
→ Change `PORT=3001` in `.env`.
