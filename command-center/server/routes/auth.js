const router = require('express').Router();
const google = require('../integrations/google');
const spotify = require('../integrations/spotify');
const github = require('../integrations/github');
const discord = require('../integrations/discord');
const reddit = require('../integrations/reddit');

// ── GOOGLE ──────────────────────────────────────────
router.get('/google', (req, res) => res.redirect(google.getAuthUrl()));
router.get('/google/callback', async (req, res) => {
  try { await google.handleCallback(req.query.code); res.redirect('/?connected=google'); }
  catch (e) { res.redirect(`/?error=${encodeURIComponent(e.message)}`); }
});

// ── SPOTIFY ─────────────────────────────────────────
router.get('/spotify', (req, res) => res.redirect(spotify.getAuthUrl()));
router.get('/spotify/callback', async (req, res) => {
  try { await spotify.handleCallback(req.query.code); res.redirect('/?connected=spotify'); }
  catch (e) { res.redirect(`/?error=${encodeURIComponent(e.message)}`); }
});

// ── GITHUB ──────────────────────────────────────────
router.get('/github', (req, res) => res.redirect(github.getAuthUrl()));
router.get('/github/callback', async (req, res) => {
  try { await github.handleCallback(req.query.code); res.redirect('/?connected=github'); }
  catch (e) { res.redirect(`/?error=${encodeURIComponent(e.message)}`); }
});

// ── DISCORD ─────────────────────────────────────────
router.get('/discord', (req, res) => res.redirect(discord.getAuthUrl()));
router.get('/discord/callback', async (req, res) => {
  try { await discord.handleCallback(req.query.code); res.redirect('/?connected=discord'); }
  catch (e) { res.redirect(`/?error=${encodeURIComponent(e.message)}`); }
});

// ── REDDIT ──────────────────────────────────────────
router.get('/reddit', (req, res) => res.redirect(reddit.getAuthUrl()));
router.get('/reddit/callback', async (req, res) => {
  try { await reddit.handleCallback(req.query.code); res.redirect('/?connected=reddit'); }
  catch (e) { res.redirect(`/?error=${encodeURIComponent(e.message)}`); }
});

module.exports = router;
