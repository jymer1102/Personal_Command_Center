const axios = require('axios');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const db = require('../db');

let botClient = null;

function getAuthUrl() {
  return `https://discord.com/api/oauth2/authorize?${new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
  })}`;
}

async function handleCallback(code) {
  const { data } = await axios.post('https://discord.com/api/oauth2/token',
    new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code',
      code, redirect_uri: process.env.DISCORD_REDIRECT_URI }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const { data: u } = await axios.get('https://discord.com/api/users/@me',
    { headers: { Authorization: `Bearer ${data.access_token}` } });
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  db.prepare(`INSERT OR REPLACE INTO tokens VALUES ('discord',?,?,?,?,?,unixepoch())`)
    .run(data.access_token, data.refresh_token, expiresAt, data.scope, JSON.stringify(u));
  return u;
}

function startBot() {
  if (!process.env.DISCORD_BOT_TOKEN || botClient) return;
  botClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });

  botClient.on(Events.ClientReady, () => console.log(`Discord bot ready: ${botClient.user.tag}`));

  botClient.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot) return;
    const row = db.prepare('SELECT user_info FROM tokens WHERE provider=?').get('discord');
    if (!row) return;
    const me = JSON.parse(row.user_info);
    const isMention = msg.mentions.users.has(me.id);
    const isDM = msg.channel.isDMBased();
    if (!isMention && !isDM) return;
    db.prepare(`INSERT OR REPLACE INTO discord_messages (id,guild,channel,author,author_avatar,content,type,timestamp,cached_at)
      VALUES (?,?,?,?,?,?,?,?,unixepoch())`)
      .run(msg.id, msg.guild?.name || 'DM', msg.channel?.name || 'DM',
        `${msg.author.username}`, `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`,
        msg.content.slice(0, 500), isDM ? 'dm' : 'mention', Math.floor(msg.createdTimestamp / 1000));
  });

  botClient.login(process.env.DISCORD_BOT_TOKEN).catch(e => console.error('Discord login:', e.message));
}

function getCachedMessages() {
  return db.prepare('SELECT * FROM discord_messages ORDER BY timestamp DESC LIMIT 30').all();
}

module.exports = { getAuthUrl, handleCallback, startBot, getCachedMessages,
  isConnected: () => !!db.prepare('SELECT 1 FROM tokens WHERE provider=?').get('discord') };
