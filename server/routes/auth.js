const router = require('express').Router();
const google = require('../integrations/google');
const spotify = require('../integrations/spotify');
const github = require('../integrations/github');
const discord = require('../integrations/discord');
const twitch = require('../integrations/twitch');

const cb = (fn) => async (req, res) => {
  try { await fn(req.query.code); res.redirect(`/?connected=${req.path.split('/')[1]}`); }
  catch (e) { res.redirect(`/?error=${encodeURIComponent(e.message)}`); }
};

router.get('/google', (req, res) => res.redirect(google.getAuthUrl()));
router.get('/google/callback', cb(code => google.handleCallback(code)));

router.get('/spotify', (req, res) => res.redirect(spotify.getAuthUrl()));
router.get('/spotify/callback', cb(code => spotify.handleCallback(code)));

router.get('/github', (req, res) => res.redirect(github.getAuthUrl()));
router.get('/github/callback', cb(code => github.handleCallback(code)));

router.get('/discord', (req, res) => res.redirect(discord.getAuthUrl()));
router.get('/discord/callback', cb(code => discord.handleCallback(code)));

router.get('/twitch', (req, res) => res.redirect(twitch.getAuthUrl()));
router.get('/twitch/callback', cb(code => twitch.handleCallback(code)));

module.exports = router;
