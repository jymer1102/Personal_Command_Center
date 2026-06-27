/* ═══════════════════════════════════════════════
   COMMAND CENTER — FRONTEND
   ═══════════════════════════════════════════════ */

let state = {
  tasks: [], emails: [], calendar: [], github: [],
  discord: [], reddit: [], spotify: null, youtube: [],
  duolingo: null, status: {},
  emailFilter: 'all', githubFilter: 'notification', redditFilter: 'post',
};

// ── INIT ──────────────────────────────────────────
async function init() {
  setDate();
  setInterval(setDate, 60000);
  await loadStatus();
  await loadDashboard();
  setupTaskInput();
  // Auto-refresh Spotify every 10s if connected
  if (state.status.spotify) setInterval(() => refreshProvider('spotify', true), 10000);
  // Check for ?connected= or ?error= params
  const params = new URLSearchParams(location.search);
  if (params.get('connected')) toast(`✓ ${params.get('connected')} connected!`, 'success');
  if (params.get('error')) toast(`Error: ${params.get('error')}`, 'error');
  if (params.get('connected') || params.get('error')) history.replaceState({}, '', '/');
}

function setDate() {
  const now = new Date();
  const opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  document.getElementById('topbarDate').textContent = now.toLocaleDateString('en-US', opts);
}

async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    state.status = await res.json();
    renderIntegrationDots();
    renderConnectBanner();
  } catch (e) { console.error(e); }
}

async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    state.tasks = data.tasks || [];
    state.emails = data.emails || [];
    state.calendar = data.calendar || [];
    state.github = data.github_items || [];
    state.discord = data.discord_msgs || [];
    state.reddit = data.reddit_items || [];
    state.spotify = data.spotify_state || null;
    state.youtube = data.youtube || [];
    state.duolingo = data.duolingo || null;
    renderAll();
  } catch (e) { console.error(e); }
}

function renderAll() {
  renderTasks();
  renderEmails();
  renderCalendar();
  renderGithub();
  renderDiscord();
  renderReddit();
  renderSpotify();
  renderDuolingo();
}

// ── INTEGRATION DOTS ──────────────────────────────
function renderIntegrationDots() {
  const container = document.getElementById('integrationsDots');
  const services = [
    { key: 'google', label: 'Google (Gmail + Calendar)', color: 'var(--cyan)' },
    { key: 'spotify', label: 'Spotify', color: 'var(--green)' },
    { key: 'github', label: 'GitHub', color: 'var(--white)' },
    { key: 'discord', label: 'Discord', color: 'var(--indigo)' },
    { key: 'reddit', label: 'Reddit', color: 'var(--orange)' },
    { key: 'duolingo', label: 'Duolingo', color: 'var(--yellow)' },
  ];
  container.innerHTML = services.map(s => `
    <div class="int-dot ${state.status[s.key] ? 'connected' : ''}" title="${s.label}: ${state.status[s.key] ? 'Connected' : 'Not connected'}"></div>
  `).join('');
}

// ── CONNECT BANNER ────────────────────────────────
function renderConnectBanner() {
  const anyConnected = Object.values(state.status).some(Boolean);
  const banner = document.getElementById('connectBanner');
  const grid = document.getElementById('connectGrid');
  if (anyConnected) { banner.style.display = 'none'; return; }
  banner.style.display = 'flex';
  const services = [
    { key: 'google', label: 'Google', icon: '🔵', desc: 'Gmail + Calendar + YouTube' },
    { key: 'spotify', label: 'Spotify', icon: '🟢', desc: 'Now playing + controls' },
    { key: 'github', label: 'GitHub', icon: '⚫', desc: 'PRs + notifications' },
    { key: 'discord', label: 'Discord', icon: '🟣', desc: 'Mentions + DMs via bot' },
    { key: 'reddit', label: 'Reddit', icon: '🟠', desc: 'Feed + messages' },
    { key: 'duolingo', label: 'Duolingo', icon: '🟡', desc: 'Set username in .env' },
  ];
  grid.innerHTML = services.map(s => `
    <a href="/auth/${s.key}" class="connect-btn ${state.status[s.key] ? 'connected' : ''}">
      <span class="cb-icon">${s.icon}</span>
      <div>
        <div>${s.label}</div>
        <div style="font-size:10px;color:var(--muted2)">${s.desc}</div>
      </div>
      <span class="cb-status">${state.status[s.key] ? '● Connected' : 'Connect'}</span>
    </a>
  `).join('');
}

// ── TASKS ─────────────────────────────────────────
function renderTasks() {
  const list = document.getElementById('taskList');
  if (!state.tasks.length) { list.innerHTML = '<div class="empty-state">No tasks — add one above</div>'; updateProgress(0, 0); return; }
  list.innerHTML = state.tasks.map(t => `
    <li class="task-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <div class="task-check" onclick="toggleTask(${t.id}, ${t.done ? 0 : 1})"></div>
      <span class="task-label" onclick="toggleTask(${t.id}, ${t.done ? 0 : 1})">${esc(t.title)}</span>
      <button class="task-del" onclick="deleteTask(${t.id})" title="Delete">✕</button>
    </li>
  `).join('');
  const done = state.tasks.filter(t => t.done).length;
  updateProgress(done, state.tasks.length);
}

function updateProgress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('taskProgressFill').style.width = pct + '%';
  document.getElementById('taskProgressPct').textContent = pct + '%';
}

function setupTaskInput() {
  const inp = document.getElementById('taskInput');
  const btn = document.getElementById('taskAddBtn');
  btn.onclick = addTask;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
}

async function addTask() {
  const inp = document.getElementById('taskInput');
  const title = inp.value.trim();
  if (!title) return;
  inp.value = '';
  try {
    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    const task = await res.json();
    state.tasks.unshift(task);
    renderTasks();
  } catch (e) { toast('Failed to add task', 'error'); }
}

async function toggleTask(id, done) {
  try {
    const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done }) });
    const updated = await res.json();
    state.tasks = state.tasks.map(t => t.id === id ? updated : t);
    // Sort: undone first, done at bottom
    state.tasks.sort((a, b) => a.done - b.done);
    renderTasks();
  } catch (e) { toast('Failed to update task', 'error'); }
}

async function deleteTask(id) {
  try {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    state.tasks = state.tasks.filter(t => t.id !== id);
    renderTasks();
  } catch (e) { toast('Failed to delete task', 'error'); }
}

// ── CALENDAR ──────────────────────────────────────
function renderCalendar() {
  const list = document.getElementById('eventsList');
  if (!state.calendar.length) { list.innerHTML = '<div class="empty-state">No upcoming events</div>'; return; }
  list.innerHTML = state.calendar.map(e => {
    const start = e.start_time ? new Date(e.start_time) : null;
    const isAllDay = e.all_day;
    const timeStr = isAllDay ? '📅' : (start ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');
    const dateStr = start ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `
      <div class="event-row">
        <div class="event-time">${timeStr}<br><span style="color:var(--muted);font-size:9px">${dateStr}</span></div>
        <div class="event-info">
          <div class="event-title">${esc(e.title)}</div>
          ${e.location ? `<div class="event-location">📍 ${esc(e.location)}</div>` : ''}
          ${e.meet_link ? `<a href="${e.meet_link}" target="_blank" class="event-meet">🎥 Join Meet</a>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── DUOLINGO ──────────────────────────────────────
function renderDuolingo() {
  const body = document.getElementById('duoBody');
  const d = state.duolingo;
  if (!d) { body.innerHTML = '<div class="empty-state">Set DUOLINGO_USERNAME in .env</div>'; return; }
  const xpPct = Math.min(100, Math.round((d.today_xp / (d.xp_goal || 50)) * 100));
  const langs = Array.isArray(d.languages) ? d.languages : (typeof d.languages === 'string' ? JSON.parse(d.languages || '[]') : []);
  body.innerHTML = `
    ${d.avatar ? `<img src="${d.avatar}" class="duo-avatar" alt="avatar" />` : ''}
    <div>
      <div class="duo-streak">${d.streak}</div>
      <div class="duo-streak-label">day streak 🔥</div>
    </div>
    <div class="duo-xp-wrap">
      <div style="font-size:11px;color:var(--muted2)">${d.today_xp} / ${d.xp_goal} XP today</div>
      <div class="duo-xp-bar-track"><div class="duo-xp-bar-fill" style="width:${xpPct}%"></div></div>
      <div style="font-size:10px;color:var(--muted2)">Total: ${(d.total_xp || 0).toLocaleString()} XP</div>
      ${langs.length ? `<div class="duo-langs">${langs.map(l => `<span class="duo-lang-tag">${l.lang}</span>`).join('')}</div>` : ''}
    </div>`;
}

// ── SPOTIFY ───────────────────────────────────────
function renderSpotify() {
  const body = document.getElementById('spotifyBody');
  const s = state.spotify;
  if (!state.status.spotify) { body.innerHTML = '<div class="empty-state">Connect Spotify</div>'; return; }
  if (!s || !s.track_name) {
    body.innerHTML = `
      <div class="spotify-art-placeholder">♫</div>
      <div><div class="spotify-not-playing">Nothing playing right now</div>
      <div class="spotify-controls" style="margin-top:8px">
        <button class="sp-btn play-pause" onclick="spotifyControl('play')" title="Play">▶</button>
      </div></div>`;
    return;
  }
  const pct = s.duration_ms ? Math.round((s.progress_ms / s.duration_ms) * 100) : 0;
  const fmt = ms => { const s = Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
  body.innerHTML = `
    ${s.album_art ? `<img src="${s.album_art}" class="spotify-art" alt="album art" />` : '<div class="spotify-art-placeholder">♫</div>'}
    <div style="flex:1;min-width:0">
      <div class="spotify-track">${esc(s.track_name)}</div>
      <div class="spotify-artist">${esc(s.artist || '')} · ${esc(s.album || '')}</div>
      <div class="spotify-progress-track"><div class="spotify-progress-fill" style="width:${pct}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted2)">
        <span>${fmt(s.progress_ms)}</span><span>${fmt(s.duration_ms)}</span>
      </div>
      <div class="spotify-controls">
        <button class="sp-btn" onclick="spotifyControl('prev')" title="Previous">⏮</button>
        <button class="sp-btn play-pause" onclick="spotifyControl('${s.is_playing ? 'pause' : 'play'}')">${s.is_playing ? '⏸' : '▶'}</button>
        <button class="sp-btn" onclick="spotifyControl('next')" title="Next">⏭</button>
      </div>
      ${s.device ? `<div class="spotify-device">Playing on ${esc(s.device)}</div>` : ''}
    </div>`;
}

async function spotifyControl(action) {
  try {
    await fetch(`/api/spotify/${action}`, { method: 'POST' });
    setTimeout(() => refreshProvider('spotify', true), 700);
  } catch (e) { toast('Spotify error', 'error'); }
}

// ── EMAILS ────────────────────────────────────────
function filterEmails(filter, el) {
  state.emailFilter = filter;
  document.querySelectorAll('.email-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderEmails();
}

function renderEmails() {
  const list = document.getElementById('emailList');
  let emails = state.emails;
  if (state.emailFilter !== 'all') emails = emails.filter(e => e.label === state.emailFilter);
  if (!emails.length) { list.innerHTML = `<div class="empty-state">No ${state.emailFilter === 'all' ? '' : state.emailFilter + ' '}emails</div>`; return; }
  list.innerHTML = emails.map(e => {
    const dotClass = { important: 'dot-important', marketing: 'dot-marketing', social: 'dot-social', updates: 'dot-updates' }[e.label] || 'dot-general';
    const unreadClass = e.is_unread ? 'email-unread' : '';
    const timeAgo = relTime(e.date);
    return `
      <div class="email-row ${unreadClass}" id="email-${e.id}">
        <div class="email-dot ${dotClass}"></div>
        <div class="email-meta">
          <div class="email-from">${esc(e.from_name || e.from_email)}</div>
          <div class="email-subject">${esc(e.subject)}</div>
          ${e.snippet ? `<div class="email-snippet">${esc(e.snippet)}</div>` : ''}
        </div>
        <div style="font-size:10px;color:var(--muted);white-space:nowrap;padding-top:2px">${timeAgo}</div>
      </div>`;
  }).join('');
}

async function purgeMarketing() {
  const btn = document.getElementById('purgeBtn');
  btn.disabled = true; btn.textContent = 'Purging…';
  // Animate removals in UI first
  state.emails.filter(e => e.label === 'marketing').forEach((e, i) => {
    setTimeout(() => {
      const row = document.getElementById('email-' + e.id);
      if (row) row.classList.add('removing');
    }, i * 120);
  });
  try {
    const res = await fetch('/api/emails/purge-marketing', { method: 'POST' });
    const { purged } = await res.json();
    state.emails = state.emails.filter(e => e.label !== 'marketing');
    setTimeout(() => { renderEmails(); btn.disabled = false; btn.textContent = 'Purge marketing'; }, state.emails.length * 120 + 400);
    toast(`🗑 Trashed ${purged} marketing emails`, 'success');
  } catch (e) { btn.disabled = false; btn.textContent = 'Purge marketing'; toast('Purge failed', 'error'); }
}

// ── GITHUB ────────────────────────────────────────
function filterGithub(filter, el) {
  state.githubFilter = filter;
  document.querySelectorAll('.github-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderGithub();
}

function renderGithub() {
  const list = document.getElementById('githubList');
  const items = state.github.filter(g => g.type === state.githubFilter);
  if (!items.length) { list.innerHTML = `<div class="empty-state">No ${state.githubFilter}s</div>`; return; }
  list.innerHTML = items.map(g => {
    const tagClass = g.state === 'private' ? 'private' : g.type;
    const label = g.type === 'pr' ? 'PR' : g.type === 'notification' ? g.state : (g.state === 'private' ? 'private' : 'public');
    return `
      <div class="gh-row">
        <a href="${g.url}" target="_blank">${esc(g.title)}</a>
        <div class="gh-meta">
          <span class="gh-tag ${tagClass}">${label}</span>
          <span class="gh-repo">${esc(g.repo)}</span>
          <span style="margin-left:auto;font-size:10px;color:var(--muted)">${relTime(g.updated_at)}</span>
        </div>
      </div>`;
  }).join('');
}

// ── DISCORD ───────────────────────────────────────
function renderDiscord() {
  const list = document.getElementById('discordList');
  if (!state.discord.length) { list.innerHTML = '<div class="empty-state">No mentions or DMs yet</div>'; return; }
  list.innerHTML = state.discord.map(m => `
    <div class="dc-row">
      ${m.author_avatar ? `<img src="${m.author_avatar}" class="dc-avatar" onerror="this.style.display='none'" />` : '<div class="dc-avatar"></div>'}
      <div class="dc-body">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="dc-author">${esc(m.author)}</span>
          <span class="dc-type">${m.type}</span>
          <span style="margin-left:auto;font-size:10px;color:var(--muted)">${relTime(m.timestamp)}</span>
        </div>
        <div class="dc-context">${esc(m.guild)} · #${esc(m.channel)}</div>
        <div class="dc-content">${esc(m.content)}</div>
      </div>
    </div>`).join('');
}

// ── REDDIT ────────────────────────────────────────
function filterReddit(filter, el) {
  state.redditFilter = filter;
  document.querySelectorAll('.reddit-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderReddit();
}

function renderReddit() {
  const list = document.getElementById('redditList');
  const items = state.reddit.filter(r => r.type === state.redditFilter);
  if (!items.length) { list.innerHTML = `<div class="empty-state">No ${state.redditFilter}s</div>`; return; }
  list.innerHTML = items.map(r => `
    <div class="rd-row">
      <div class="rd-sub">r/${esc(r.subreddit)} · u/${esc(r.author)}</div>
      <div class="rd-title"><a href="${r.url}" target="_blank">${esc(r.title)}</a></div>
      ${r.type === 'post' ? `<div class="rd-meta">▲ ${r.score} · ${r.num_comments} comments · ${relTime(r.created_at)}</div>` : ''}
    </div>`).join('');
}

// ── REFRESH ───────────────────────────────────────
async function refreshProvider(provider, silent = false) {
  if (!silent) toast(`Refreshing ${provider}…`);
  try {
    const res = await fetch(`/api/refresh/${provider}`, { method: 'POST' });
    const { data } = await res.json();
    if (provider === 'google') {
      if (data.emails) state.emails = data.emails;
      if (data.calendar) state.calendar = data.calendar;
      if (data.youtube) state.youtube = data.youtube;
      renderEmails(); renderCalendar();
    } else if (provider === 'spotify') {
      if (data) state.spotify = data;
      renderSpotify();
    } else if (provider === 'github') {
      if (data) state.github = [...(data.prs||[]), ...(data.notifications||[]), ...(data.repos||[])];
      renderGithub();
    } else if (provider === 'discord') {
      if (data) state.discord = data;
      renderDiscord();
    } else if (provider === 'reddit') {
      if (data) state.reddit = [...(data.feed||[]), ...(data.messages||[])];
      renderReddit();
    } else if (provider === 'duolingo') {
      if (data) state.duolingo = data;
      renderDuolingo();
    }
    if (!silent) toast(`${provider} refreshed`, 'success');
  } catch (e) { if (!silent) toast(`Failed to refresh ${provider}`, 'error'); }
}

document.getElementById('refreshAllBtn').addEventListener('click', async () => {
  const btn = document.getElementById('refreshAllBtn');
  btn.classList.add('spinning');
  await loadDashboard();
  btn.classList.remove('spinning');
  toast('All data refreshed', 'success');
});

// ── UTILS ─────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function relTime(ts) {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function toast(msg, type = '') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

init();
