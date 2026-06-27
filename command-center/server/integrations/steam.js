// Steam — free Web API key, no OAuth (uses Steam ID)
const axios = require('axios');

async function fetchSteam() {
  const key = process.env.STEAM_API_KEY;
  const steamId = process.env.STEAM_ID;
  if (!key || !steamId) return null;
  try {
    const [recent, owned, summary] = await Promise.allSettled([
      axios.get(`https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${key}&steamid=${steamId}&count=5&format=json`),
      axios.get(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${steamId}&include_appinfo=true&format=json`),
      axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${steamId}&format=json`),
    ]);
    const recentGames = recent.status === 'fulfilled' ? (recent.value.data.response?.games || []).map(g => ({
      name: g.name, appid: g.appid,
      playtime_2weeks: Math.round(g.playtime_2weeks / 60 * 10) / 10,
      playtime_forever: Math.round(g.playtime_forever / 60),
      img: `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`,
      url: `https://store.steampowered.com/app/${g.appid}`,
    })) : [];
    const totalGames = owned.status === 'fulfilled' ? owned.value.data.response?.game_count || 0 : 0;
    const profile = summary.status === 'fulfilled' ? summary.value.data.response?.players?.[0] : null;
    return { recentGames, totalGames, profile: profile ? { name: profile.personaname, avatar: profile.avatarmedium, status: profile.personastate, url: profile.profileurl } : null };
  } catch (e) { console.error('Steam:', e.message); return null; }
}

module.exports = { fetchSteam, isConfigured: () => !!(process.env.STEAM_API_KEY && process.env.STEAM_ID) };
