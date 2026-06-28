const axios = require('axios');
const db = require('../db');

// Duolingo's unofficial API — no auth needed, just a username
async function fetchStreak(username) {
  if (!username) username = process.env.DUOLINGO_USERNAME;
  if (!username) return null;
  try {
    const { data } = await axios.get(`https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 CommandCenter/2.0' },
      timeout: 8000,
    });
    const user = data.users?.[0];
    if (!user) return null;
    const streak = user.streak || 0;
    const todayXp = user.xpGoalMetToday ? (user.xpGains?.filter(g => {
      const d = new Date(g.time * 1000); const now = new Date();
      return d.toDateString() === now.toDateString();
    }).reduce((a, b) => a + b.xp, 0) || 0) : 0;
    const languages = (user.courses || []).map(c => ({ lang: c.title, xp: c.xp }));
    const state = { username: user.username, streak, total_xp: user.totalXp || 0,
      today_xp: todayXp, xp_goal: user.xpGoal || 50,
      league: user.currentCourse?.title || null, languages: JSON.stringify(languages),
      avatar: user.picture || null };
    db.prepare(`INSERT OR REPLACE INTO duolingo_state (id,username,streak,total_xp,today_xp,xp_goal,league,languages,avatar,updated_at)
      VALUES (1,?,?,?,?,?,?,?,?,unixepoch())`)
      .run(state.username,state.streak,state.total_xp,state.today_xp,state.xp_goal,state.league,state.languages,state.avatar);
    return state;
  } catch (e) { console.error('Duolingo:', e.message); return null; }
}

function getCached() {
  const row = db.prepare('SELECT * FROM duolingo_state WHERE id=1').get();
  if (!row) return null;
  try { row.languages = JSON.parse(row.languages || '[]'); } catch { row.languages = []; }
  return row;
}

module.exports = { fetchStreak, getCached,
  isConfigured: () => !!process.env.DUOLINGO_USERNAME };
