const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'center.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    provider TEXT PRIMARY KEY,
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    scope TEXT,
    user_info TEXT,
    updated_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    source TEXT DEFAULT 'manual',
    source_id TEXT,
    due_date TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    from_name TEXT,
    from_email TEXT,
    subject TEXT,
    snippet TEXT,
    label TEXT,
    is_unread INTEGER DEFAULT 1,
    date INTEGER,
    cached_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT,
    start_time TEXT,
    end_time TEXT,
    location TEXT,
    meet_link TEXT,
    all_day INTEGER DEFAULT 0,
    cached_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS github_items (
    id TEXT PRIMARY KEY,
    type TEXT,
    title TEXT,
    repo TEXT,
    url TEXT,
    state TEXT,
    updated_at INTEGER,
    cached_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS discord_messages (
    id TEXT PRIMARY KEY,
    guild TEXT,
    channel TEXT,
    author TEXT,
    author_avatar TEXT,
    content TEXT,
    type TEXT DEFAULT 'mention',
    timestamp INTEGER,
    cached_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS reddit_items (
    id TEXT PRIMARY KEY,
    type TEXT,
    title TEXT,
    subreddit TEXT,
    url TEXT,
    score INTEGER,
    num_comments INTEGER,
    author TEXT,
    created_at INTEGER,
    cached_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS spotify_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_playing INTEGER DEFAULT 0,
    track_name TEXT,
    artist TEXT,
    album TEXT,
    album_art TEXT,
    track_url TEXT,
    progress_ms INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    device TEXT,
    updated_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS youtube_items (
    id TEXT PRIMARY KEY,
    title TEXT,
    channel TEXT,
    thumbnail TEXT,
    url TEXT,
    view_count INTEGER,
    published_at INTEGER,
    cached_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS duolingo_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    username TEXT,
    streak INTEGER DEFAULT 0,
    total_xp INTEGER DEFAULT 0,
    today_xp INTEGER DEFAULT 0,
    xp_goal INTEGER DEFAULT 50,
    league TEXT,
    languages TEXT,
    avatar TEXT,
    updated_at INTEGER DEFAULT (unixepoch())
  );
`);

module.exports = db;

// Run additional migrations for new integrations
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS twitch_streams (
      user_login TEXT PRIMARY KEY,
      user_name TEXT,
      game_name TEXT,
      title TEXT,
      viewer_count INTEGER,
      thumbnail TEXT,
      url TEXT,
      started_at TEXT,
      cached_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS notion_pages (
      id TEXT PRIMARY KEY,
      title TEXT,
      url TEXT,
      last_edited TEXT,
      icon TEXT,
      cached_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS news_items (
      url TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      source TEXT,
      published_at TEXT,
      image TEXT,
      cached_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS bible_verse (
      id INTEGER PRIMARY KEY DEFAULT 1,
      reference TEXT,
      text TEXT,
      translation TEXT,
      date TEXT,
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `);
} catch(e) {}
