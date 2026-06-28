/* ═══════════════════════════════════════════════
   PERSONAL COMMAND CENTER — FRONTEND v3
   ═══════════════════════════════════════════════ */

let state = {
  tasks: [], emails: [], calendar: [], github: [], discord: [],
  spotify: null, youtube: [], duolingo: null, twitch: [], news: [],
  bible: null, status: {}, emailFilter: 'all', githubFilter: 'notification',
};

// ── INIT ──────────────────────────────────────────
async function init() {
  setDate();
  setInterval(setDate, 60000);
  setupTaskInput();

  try { await loadStatus(); } catch(e) { console.error('Status load failed:', e); }
  try { await loadDashboard(); } catch(e) { console.error('Dashboard load failed:', e); }

  // Non-blocking side loads
  loadWeather();
  loadLastFm();

  // Spotify poll
  if (state.status.spotify) {
    setInterval(() => refreshProvider('spotify', true), 10000);
  }

  // Handle ?connected= / ?error= redirect params
  const p = new URLSearchParams(location.search);
  if (p.get('connected')) toast(`✓ ${p.get('connected')} connected!`, 'success');
  if (p.get('error')) toast(`Error: ${p.get('error')}`, 'error');
  if (p.get('connected') || p.get('error')) history.replaceState({}, '', '/');
}

function setDate() {
  const el = document.getElementById('topbarDate');
  if (el) el.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
}

async function loadStatus() {
  const r = await fetch('/api/status');
  if (!r.ok) throw new Error('Status ' + r.status);
  state.status = await r.json();
  renderIntegrationDots();
  renderConnectBanner();
}

async function loadDashboard() {
  const r = await fetch('/api/dashboard');
  if (!r.ok) throw new Error('Dashboard ' + r.status);
  const d = await r.json();
  state.tasks        = d.tasks         || [];
  state.emails       = d.emails        || [];
  state.calendar     = d.calendar      || [];
  state.github       = d.github_items  || [];
  state.discord      = d.discord_msgs  || [];
  state.spotify      = d.spotify_state || null;
  state.youtube      = d.youtube       || [];
  state.duolingo     = d.duolingo      || null;
  state.twitch       = d.twitch_streams|| [];
  state.news         = d.news_items    || [];
  state.bible        = d.bible_verse   || null;
  renderAll();
}

function renderAll() {
  renderTasks();
  renderEmails();
  renderCalendar();
  renderGithub();
  renderDiscord();
  renderSpotify();
  renderDuolingo();
  renderTwitch();
  renderNews();
  renderBible();
}

// ── INTEGRATION DOTS ──────────────────────────────
function renderIntegrationDots() {
  const services = [
    {key:'google', label:'Google'},
    {key:'spotify', label:'Spotify'},
    {key:'github',  label:'GitHub'},
    {key:'discord', label:'Discord'},
    {key:'twitch',  label:'Twitch'},
    {key:'duolingo',label:'Duolingo'},
    {key:'weather', label:'Weather'},
    {key:'news',    label:'News'},
    {key:'lastfm',  label:'Last.fm'},
  ];
  const el = document.getElementById('integrationsDots');
  if (!el) return;
  el.innerHTML = services.map(s =>
    `<div class="int-dot ${state.status[s.key] ? 'connected' : ''}" title="${s.label}: ${state.status[s.key] ? 'Connected' : 'Not connected'}"></div>`
  ).join('');
}

// ── CONNECT BANNER ────────────────────────────────
function renderConnectBanner() {
  const anyConnected = Object.values(state.status).some(Boolean);
  const banner = document.getElementById('connectBanner');
  if (!banner) return;
  if (anyConnected) { banner.style.display = 'none'; return; }
  banner.style.display = 'flex';
  const services = [
    {key:'google',  label:'Google',  icon:'🔵', desc:'Gmail + Calendar + YouTube'},
    {key:'spotify', label:'Spotify', icon:'🟢', desc:'Now playing + controls'},
    {key:'github',  label:'GitHub',  icon:'⚫', desc:'PRs + notifications'},
    {key:'discord', label:'Discord', icon:'🟣', desc:'Mentions + DMs via bot'},
    {key:'twitch',  label:'Twitch',  icon:'🟣', desc:'Live streams you follow'},
  ];
  const grid = document.getElementById('connectGrid');
  if (grid) grid.innerHTML = services.map(s =>
    `<a href="/auth/${s.key}" class="connect-btn ${state.status[s.key] ? 'connected' : ''}">
      <span class="cb-icon">${s.icon}</span>
      <div><div>${s.label}</div><div style="font-size:10px;color:var(--muted2)">${s.desc}</div></div>
      <span class="cb-status">${state.status[s.key] ? '● Connected' : 'Connect'}</span>
    </a>`
  ).join('');
}

// ── TASKS ─────────────────────────────────────────
function renderTasks() {
  const list = document.getElementById('taskList');
  if (!list) return;
  if (!state.tasks.length) {
    list.innerHTML = '<div class="empty-state">No tasks — add one above</div>';
    updateProgress(0, 0); return;
  }
  list.innerHTML = state.tasks.map(t =>
    `<li class="task-item ${t.done ? 'done' : ''}">
      <div class="task-check" onclick="toggleTask(${t.id}, ${t.done ? 0 : 1})"></div>
      <span class="task-label" onclick="toggleTask(${t.id}, ${t.done ? 0 : 1})">${esc(t.title)}</span>
      <button class="task-del" onclick="deleteTask(${t.id})">✕</button>
    </li>`
  ).join('');
  const done = state.tasks.filter(t => t.done).length;
  updateProgress(done, state.tasks.length);
}

function updateProgress(done, total) {
  const pct = total ? Math.round(done / total * 100) : 0;
  const fill = document.getElementById('taskProgressFill');
  const pctEl = document.getElementById('taskProgressPct');
  if (fill) fill.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
}

function setupTaskInput() {
  const inp = document.getElementById('taskInput');
  const btn = document.getElementById('taskAddBtn');
  if (btn) btn.onclick = addTask;
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
}

async function addTask() {
  const inp = document.getElementById('taskInput');
  if (!inp) return;
  const title = inp.value.trim();
  if (!title) return;
  inp.value = '';
  try {
    const r = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!r.ok) throw new Error('Failed');
    const task = await r.json();
    state.tasks.unshift(task);
    renderTasks();
  } catch(e) { toast('Failed to add task', 'error'); }
}

async function toggleTask(id, done) {
  try {
    const r = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    });
    const updated = await r.json();
    state.tasks = state.tasks.map(t => t.id === id ? updated : t).sort((a, b) => a.done - b.done);
    renderTasks();
  } catch(e) { toast('Failed to update task', 'error'); }
}

async function deleteTask(id) {
  try {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    state.tasks = state.tasks.filter(t => t.id !== id);
    renderTasks();
  } catch(e) { toast('Failed to delete task', 'error'); }
}

// ── BIBLE ─────────────────────────────────────────
function renderBible() {
  const el = document.getElementById('bibleBody');
  if (!el) return;
  const b = state.bible;
  if (!b || !b.text) { el.innerHTML = '<div class="empty-state">Loading verse…</div>'; return; }
  el.innerHTML = `
    <div class="bible-ref">📖 ${esc(b.reference)}</div>
    <div class="bible-text">"${esc(b.text)}"</div>
    <div class="bible-translation">${esc(b.translation || 'KJV')}</div>`;
}

// ── CALENDAR ──────────────────────────────────────
function renderCalendar() {
  const list = document.getElementById('eventsList');
  if (!list) return;
  if (!state.calendar.length) { list.innerHTML = '<div class="empty-state">No upcoming events</div>'; return; }
  list.innerHTML = state.calendar.map(e => {
    const start = e.start_time ? new Date(e.start_time) : null;
    const timeStr = e.all_day ? 'All day' : (start ? start.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}) : '');
    const dateStr = start ? start.toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';
    return `<div class="event-row">
      <div class="event-time">${esc(timeStr)}<br><span style="color:var(--muted);font-size:9px">${esc(dateStr)}</span></div>
      <div class="event-info">
        <div class="event-title">${esc(e.title)}</div>
        ${e.location ? `<div class="event-location">📍 ${esc(e.location)}</div>` : ''}
        ${e.meet_link ? `<a href="${esc(e.meet_link)}" target="_blank" class="event-meet">🎥 Join Meet</a>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── DUOLINGO ──────────────────────────────────────
function renderDuolingo() {
  const el = document.getElementById('duoBody');
  if (!el) return;
  const d = state.duolingo;
  if (!d) { el.innerHTML = '<div class="empty-state">Set DUOLINGO_USERNAME in env</div>'; return; }
  const xpPct = Math.min(100, Math.round((d.today_xp / (d.xp_goal || 50)) * 100));
  let langs = [];
  try { langs = typeof d.languages === 'string' ? JSON.parse(d.languages || '[]') : (d.languages || []); } catch(e) {}
  el.innerHTML = `
    ${d.avatar ? `<img src="${esc(d.avatar)}" class="duo-avatar" alt="avatar" />` : ''}
    <div>
      <div class="duo-streak">${d.streak}</div>
      <div class="duo-streak-label">day streak 🔥</div>
    </div>
    <div class="duo-xp-wrap">
      <div style="font-size:11px;color:var(--muted2)">${d.today_xp} / ${d.xp_goal} XP today</div>
      <div class="duo-xp-bar-track"><div class="duo-xp-bar-fill" style="width:${xpPct}%"></div></div>
      <div style="font-size:10px;color:var(--muted2)">Total: ${(d.total_xp || 0).toLocaleString()} XP</div>
      ${langs.length ? `<div class="duo-langs">${langs.map(l => `<span class="duo-lang-tag">${esc(l.lang)}</span>`).join('')}</div>` : ''}
    </div>`;
}

// ── WEATHER ───────────────────────────────────────
async function loadWeather() {
  if (!state.status.weather) return;
  try {
    const r = await fetch('/api/weather');
    if (!r.ok) return;
    const d = await r.json();
    if (!d || !d.temp) return;
    const forecast = (d.forecast || []).slice(0, 6).map(f => {
      const t = new Date(f.time * 1000);
      return `<div class="weather-slot">
        <div class="weather-slot-time">${t.getHours()}:00</div>
        <img src="https://openweathermap.org/img/wn/${f.icon}.png" style="width:22px;height:22px" alt="" />
        <div class="weather-slot-temp">${f.temp}°</div>
      </div>`;
    }).join('');
    const el = document.getElementById('weatherBody');
    if (!el) return;
    el.innerHTML = `
      <div class="weather-main">
        <img src="https://openweathermap.org/img/wn/${d.icon}@2x.png" style="width:48px;height:48px" alt="" />
        <div>
          <div class="weather-temp">${d.temp}°F</div>
          <div class="weather-desc">${esc(d.description)} · Feels ${d.feels_like}°</div>
          <div class="weather-meta">
            <span>💧 ${d.humidity}%</span>
            <span>💨 ${d.wind} mph</span>
            <span>📍 ${esc(d.city)}</span>
          </div>
        </div>
      </div>
      <div class="weather-forecast">${forecast}</div>`;
  } catch(e) { console.error('Weather:', e); }
}

// ── SPOTIFY ───────────────────────────────────────
function renderSpotify() {
  const el = document.getElementById('spotifyBody');
  if (!el) return;
  const s = state.spotify;
  if (!state.status.spotify) { el.innerHTML = '<div class="empty-state">Connect Spotify</div>'; return; }
  if (!s || !s.track_name) {
    el.innerHTML = `
      <div class="spotify-art-placeholder">♫</div>
      <div>
        <div class="spotify-not-playing">Nothing playing right now</div>
        <div class="spotify-controls" style="margin-top:8px">
          <button class="sp-btn play-pause" onclick="spotifyControl('play')">▶</button>
        </div>
      </div>`;
    return;
  }
  const pct = s.duration_ms ? Math.round(s.progress_ms / s.duration_ms * 100) : 0;
  const fmt = ms => { const sec = Math.floor(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  el.innerHTML = `
    ${s.album_art ? `<img src="${esc(s.album_art)}" class="spotify-art" alt="album" />` : '<div class="spotify-art-placeholder">♫</div>'}
    <div style="flex:1;min-width:0">
      <div class="spotify-track">${esc(s.track_name)}</div>
      <div class="spotify-artist">${esc(s.artist || '')} · ${esc(s.album || '')}</div>
      <div class="spotify-progress-track"><div class="spotify-progress-fill" style="width:${pct}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted2)">
        <span>${fmt(s.progress_ms || 0)}</span><span>${fmt(s.duration_ms || 0)}</span>
      </div>
      <div class="spotify-controls">
        <button class="sp-btn" onclick="spotifyControl('prev')">⏮</button>
        <button class="sp-btn play-pause" onclick="spotifyControl('${s.is_playing ? 'pause' : 'play'}')">${s.is_playing ? '⏸' : '▶'}</button>
        <button class="sp-btn" onclick="spotifyControl('next')">⏭</button>
      </div>
      ${s.device ? `<div class="spotify-device">📱 ${esc(s.device)}</div>` : ''}
    </div>`;
}

async function spotifyControl(action) {
  try {
    await fetch(`/api/spotify/${action}`, { method: 'POST' });
    setTimeout(() => refreshProvider('spotify', true), 700);
  } catch(e) { toast('Spotify error', 'error'); }
}

// ── LAST.FM ───────────────────────────────────────
async function loadLastFm() {
  if (!state.status.lastfm) return;
  try {
    const r = await fetch('/api/lastfm');
    if (!r.ok) return;
    const d = await r.json();
    if (!d || !d.recentTracks || !d.recentTracks.length) return;
    const el = document.getElementById('lastfmBody');
    if (!el) return;
    el.innerHTML =
      `<div style="font-size:11px;color:var(--muted2);margin-bottom:8px">🎵 ${(d.scrobbles || 0).toLocaleString()} total scrobbles</div>` +
      d.recentTracks.slice(0, 5).map(t => `
        <div class="lastfm-row">
          ${t.image ? `<img src="${esc(t.image)}" class="lastfm-art" alt="" />` : '<div class="lastfm-art"></div>'}
          <div class="lastfm-info">
            <div class="lastfm-track">${esc(t.name)}</div>
            <div class="lastfm-artist">${esc(t.artist)}</div>
          </div>
          ${t.nowPlaying
            ? '<span class="lastfm-now">▶ now</span>'
            : t.date ? `<span style="font-size:10px;color:var(--muted)">${relTime(t.date)}</span>` : ''}
        </div>`
      ).join('');
  } catch(e) { console.error('LastFM:', e); }
}

// ── EMAILS ────────────────────────────────────────
function filterEmails(f, el) {
  state.emailFilter = f;
  document.querySelectorAll('.email-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderEmails();
}

function renderEmails() {
  const list = document.getElementById('emailList');
  if (!list) return;
  let emails = state.emails;
  if (state.emailFilter !== 'all') emails = emails.filter(e => e.label === state.emailFilter);
  if (!emails.length) { list.innerHTML = `<div class="empty-state">No ${state.emailFilter === 'all' ? '' : state.emailFilter + ' '}emails</div>`; return; }
  const dotClass = { important:'dot-important', marketing:'dot-marketing', social:'dot-social', updates:'dot-updates' };
  list.innerHTML = emails.map(e => `
    <div class="email-row ${e.is_unread ? 'email-unread' : ''}" id="email-${e.id}">
      <div class="email-dot ${dotClass[e.label] || 'dot-general'}"></div>
      <div class="email-meta">
        <div class="email-from">${esc(e.from_name || e.from_email)}</div>
        <div class="email-subject">${esc(e.subject)}</div>
        ${e.snippet ? `<div class="email-snippet">${esc(e.snippet)}</div>` : ''}
      </div>
      <div style="font-size:10px;color:var(--muted);white-space:nowrap;padding-top:2px">${relTime(e.date)}</div>
    </div>`
  ).join('');
}

async function purgeMarketing() {
  const btn = document.getElementById('purgeBtn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Purging…';
  state.emails.filter(e => e.label === 'marketing').forEach((e, i) => {
    setTimeout(() => {
      const row = document.getElementById('email-' + e.id);
      if (row) row.classList.add('removing');
    }, i * 120);
  });
  try {
    const r = await fetch('/api/emails/purge-marketing', { method: 'POST' });
    const { purged } = await r.json();
    state.emails = state.emails.filter(e => e.label !== 'marketing');
    setTimeout(() => { renderEmails(); btn.disabled = false; btn.textContent = 'Purge marketing'; }, 600);
    toast(`🗑 Trashed ${purged} marketing emails`, 'success');
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Purge marketing';
    toast('Purge failed', 'error');
  }
}

// ── GITHUB ────────────────────────────────────────
function filterGithub(f, el) {
  state.githubFilter = f;
  document.querySelectorAll('.github-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderGithub();
}

function renderGithub() {
  const list = document.getElementById('githubList');
  if (!list) return;
  const items = state.github.filter(g => g.type === state.githubFilter);
  if (!items.length) { list.innerHTML = `<div class="empty-state">No ${state.githubFilter}s</div>`; return; }
  list.innerHTML = items.map(g => `
    <div class="gh-row">
      <a href="${esc(g.url)}" target="_blank" rel="noopener">${esc(g.title)}</a>
      <div class="gh-meta">
        <span class="gh-tag ${g.state === 'private' ? 'private' : g.type}">${g.type === 'pr' ? 'PR' : g.type === 'notification' ? g.state : g.state}</span>
        <span class="gh-repo">${esc(g.repo)}</span>
        <span style="margin-left:auto;font-size:10px;color:var(--muted)">${relTime(g.updated_at)}</span>
      </div>
    </div>`
  ).join('');
}

// ── DISCORD ───────────────────────────────────────
function renderDiscord() {
  const list = document.getElementById('discordList');
  if (!list) return;
  if (!state.discord.length) { list.innerHTML = '<div class="empty-state">No mentions or DMs yet</div>'; return; }
  list.innerHTML = state.discord.map(m => `
    <div class="dc-row">
      ${m.author_avatar ? `<img src="${esc(m.author_avatar)}" class="dc-avatar" onerror="this.style.display='none'" alt="" />` : '<div class="dc-avatar"></div>'}
      <div class="dc-body">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="dc-author">${esc(m.author)}</span>
          <span class="dc-type">${esc(m.type)}</span>
          <span style="margin-left:auto;font-size:10px;color:var(--muted)">${relTime(m.timestamp)}</span>
        </div>
        <div class="dc-context">${esc(m.guild)} · #${esc(m.channel)}</div>
        <div class="dc-content">${esc(m.content)}</div>
      </div>
    </div>`
  ).join('');
}

// ── TWITCH ────────────────────────────────────────
function renderTwitch() {
  const list = document.getElementById('twitchList');
  if (!list) return;
  if (!state.status.twitch) { list.innerHTML = '<div class="empty-state">Connect Twitch</div>'; return; }
  if (!state.twitch.length) { list.innerHTML = '<div class="empty-state">No followed streams live right now</div>'; return; }
  list.innerHTML = state.twitch.map(s => `
    <div class="twitch-row">
      ${s.thumbnail ? `<img src="${esc(s.thumbnail)}" class="twitch-thumb" alt="" />` : '<div class="twitch-thumb"></div>'}
      <div class="twitch-info">
        <div class="twitch-name"><span class="live-dot"></span><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.user_name)}</a></div>
        <div class="twitch-game">${esc(s.game_name)}</div>
        <div class="twitch-viewers">👁 ${(s.viewer_count || 0).toLocaleString()}</div>
      </div>
    </div>`
  ).join('');
}

// ── NEWS ──────────────────────────────────────────
function renderNews() {
  const list = document.getElementById('newsList');
  if (!list) return;
  if (!state.news.length) { list.innerHTML = '<div class="empty-state">Set NEWS_API_KEY in env</div>'; return; }
  list.innerHTML = state.news.map(n => `
    <div class="news-row">
      <div class="news-source">${esc(n.source || '')}</div>
      <div class="news-title"><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a></div>
    </div>`
  ).join('');
}

// ── REFRESH ───────────────────────────────────────
async function refreshProvider(provider, silent = false) {
  if (!silent) toast(`Refreshing ${provider}…`);
  try {
    const r = await fetch(`/api/refresh/${provider}`, { method: 'POST' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const json = await r.json();
    const data = json.data;
    if (provider === 'google') {
      if (data && data.emails)   state.emails   = data.emails;
      if (data && data.calendar) state.calendar = data.calendar;
      renderEmails(); renderCalendar();
    } else if (provider === 'spotify') {
      if (data) state.spotify = data; renderSpotify();
    } else if (provider === 'github') {
      if (data) state.github = [...(data.prs||[]), ...(data.notifications||[]), ...(data.repos||[])];
      renderGithub();
    } else if (provider === 'discord') {
      if (data) state.discord = data; renderDiscord();
    } else if (provider === 'duolingo') {
      if (data) state.duolingo = data; renderDuolingo();
    } else if (provider === 'twitch') {
      if (data) state.twitch = data; renderTwitch();
    } else if (provider === 'news') {
      if (data) state.news = data; renderNews();
    } else if (provider === 'bible') {
      if (data) state.bible = data; renderBible();
    }
    if (!silent) toast(`${provider} refreshed`, 'success');
  } catch(e) {
    console.error('Refresh error:', e);
    if (!silent) toast(`Failed to refresh ${provider}`, 'error');
  }
}

document.getElementById('refreshAllBtn').addEventListener('click', async () => {
  const btn = document.getElementById('refreshAllBtn');
  if (btn) btn.classList.add('spinning');
  try {
    await loadDashboard();
    loadWeather();
    loadLastFm();
    toast('All data refreshed', 'success');
  } catch(e) {
    toast('Refresh failed', 'error');
  }
  if (btn) btn.classList.remove('spinning');
});

// ── UTILS ─────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function relTime(ts) {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000) - Number(ts);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function toast(msg, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── START ──────────────────────────────────────────
init();
