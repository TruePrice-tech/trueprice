#!/usr/bin/env node
/**
 * Harvest real user phrasings from Reddit. Reddit users phrase things very
 * differently from SEO tools — more natural language, more specific scenarios,
 * more frustration-driven ("is $X too much for", "am I being ripped off").
 * These are gold for long-tail matching.
 *
 * Strategy: for each seed, search relevant subreddits via the public JSON
 * endpoint. Extract post titles (users literally write their question in
 * the title).
 *
 * Endpoint: https://www.reddit.com/r/<subreddit>/search.json?q=<q>&restrict_sr=1&sort=relevance&limit=25
 *
 * Output: scripts/keyword-research/output/reddit-raw.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SEEDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'seeds.json'), 'utf8'));
const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const PILOT = process.argv.includes('--pilot');
const DELAY_MS = 1500;  // Reddit rate-limits aggressively; be conservative

// Subreddits to search per vertical. Mix of generic + vertical-specific.
const SUBREDDITS = {
  hvac: ['HVAC', 'HomeImprovement', 'hvacadvice'],
  roof: ['Roofing', 'HomeImprovement'],
  plumbing: ['Plumbing', 'HomeImprovement'],
  electrical: ['Electricians', 'HomeImprovement'],
  solar: ['solar', 'HomeImprovement'],
  concrete: ['Concrete', 'HomeImprovement'],
  painting: ['HomeImprovement', 'housepainting'],
  fence: ['HomeImprovement', 'fencing'],
  foundation: ['HomeImprovement', 'structuralengineering'],
  siding: ['HomeImprovement'],
  window: ['HomeImprovement'],
  insulation: ['HomeImprovement', 'Insulation'],
  gutter: ['HomeImprovement'],
  landscaping: ['landscaping', 'HomeImprovement'],
  'kitchen-remodel': ['HomeImprovement', 'kitchenrenovations', 'DIY'],
  'garage-door': ['HomeImprovement', 'GarageDoors'],
  'auto-repair': ['MechanicAdvice', 'Cartalk'],
  legal: ['legaladvice', 'Lawyertalk'],
  medical: ['medicalbill', 'personalfinance'],
  moving: ['moving'],
  meta: ['HomeImprovement', 'AskContractors'],
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        // Reddit's public JSON endpoint rejects generic/bot-looking UAs.
        // Use a browser-style UA to match the way a human visitor hits it.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse fail: ${data.slice(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function redditSearch(subreddit, query) {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance&limit=25&t=year`;
  try {
    const json = await fetchJson(url);
    const posts = json?.data?.children || [];
    return posts.map(p => ({
      title: p.data.title,
      score: p.data.score,
      numComments: p.data.num_comments,
      subreddit: p.data.subreddit,
    }));
  } catch (e) {
    return { error: e.message };
  }
}

// Build job list: (vertical, seed, subreddit)
const jobs = [];
for (const [vertical, seeds] of Object.entries(SEEDS.verticals)) {
  const subs = SUBREDDITS[vertical] || ['HomeImprovement'];
  for (const s of seeds) for (const sub of subs) jobs.push({ vertical, seed: s, subreddit: sub });
}
for (const s of SEEDS.meta) {
  for (const sub of SUBREDDITS.meta) jobs.push({ vertical: 'meta', seed: s, subreddit: sub });
}

const jobsToRun = PILOT ? jobs.slice(0, 10) : jobs;
console.log(`Running on ${jobsToRun.length} (subreddit,seed) jobs (${PILOT ? 'PILOT' : 'FULL'})`);
console.log(`ETA: ~${Math.ceil(jobsToRun.length * DELAY_MS / 1000 / 60)} minutes\n`);

(async () => {
  const output = [];
  let okCount = 0, emptyCount = 0, errorCount = 0;

  for (let i = 0; i < jobsToRun.length; i++) {
    const { vertical, seed, subreddit } = jobsToRun[i];
    const result = await redditSearch(subreddit, seed);
    if (result?.error) {
      errorCount++;
    } else if (Array.isArray(result) && result.length === 0) {
      emptyCount++;
    } else if (Array.isArray(result)) {
      okCount++;
      for (const post of result) {
        output.push({ vertical, seed, subreddit, ...post });
      }
    }

    if ((i + 1) % 20 === 0 || i === jobsToRun.length - 1) {
      process.stdout.write(`  [${i+1}/${jobsToRun.length}] ok:${okCount} empty:${emptyCount} err:${errorCount} — ${output.length} titles\r`);
    }
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(
    path.join(OUT_DIR, PILOT ? 'reddit-pilot.json' : 'reddit-raw.json'),
    JSON.stringify(output, null, 2),
    'utf8'
  );
  console.log(`\n\nDone. ${output.length} Reddit post titles collected.`);
})();
