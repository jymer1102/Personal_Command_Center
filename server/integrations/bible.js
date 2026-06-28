const axios = require('axios');
const db = require('../db');

const VERSES = [
  'john 3:16','psalm 23:1','philippians 4:13','jeremiah 29:11','romans 8:28',
  'isaiah 40:31','proverbs 3:5-6','matthew 6:33','psalm 46:1','john 14:6',
  'romans 12:2','galatians 5:22-23','ephesians 2:8-9','hebrews 11:1','james 1:2-4',
  'matthew 5:16','john 15:13','romans 5:8','1 corinthians 13:4-7','psalm 119:105',
  '2 timothy 1:7','isaiah 41:10','matthew 11:28-30','john 10:10','psalm 27:1',
  'romans 8:38-39','colossians 3:23','joshua 1:9','micah 6:8','john 3:17',
];

function getTodayVerse() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return VERSES[dayOfYear % VERSES.length];
}

async function fetchDailyVerse() {
  const ref = getTodayVerse();
  try {
    const { data } = await axios.get(`https://bible-api.com/${encodeURIComponent(ref)}?translation=kjv`, { timeout: 8000 });
    const result = { reference: data.reference, text: data.text?.trim(), translation: 'KJV' };
    db.prepare(`INSERT OR REPLACE INTO bible_verse (id,reference,text,translation,updated_at) VALUES (1,?,?,?,unixepoch())`)
      .run(result.reference, result.text, result.translation);
    return result;
  } catch (e) {
    console.error('Bible API:', e.message);
    const fallback = { reference: 'John 3:16', translation: 'KJV',
      text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' };
    db.prepare(`INSERT OR REPLACE INTO bible_verse (id,reference,text,translation,updated_at) VALUES (1,?,?,?,unixepoch())`)
      .run(fallback.reference, fallback.text, fallback.translation);
    return fallback;
  }
}

module.exports = { fetchDailyVerse, isConfigured: () => true };
