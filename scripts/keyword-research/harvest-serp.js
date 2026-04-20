#!/usr/bin/env node
/**
 * Scrape Bing SERP for the top-N organic results per target query. Used for
 * competitor gap analysis: extract each competitor's page title and main
 * heading so we know what topics they cover and what to beat.
 *
 * Takes the list of target queries from keywords-filtered.json (produced by
 * aggregate-and-filter.js) and runs SERPs for the top N.
 *
 * Uses DuckDuckGo's plain-HTML SERP (html.duckduckgo.com). Bing and Google
 * both require JS execution for modern SERP rendering; DDG returns clean
 * static HTML that's easy to parse. DDG's results pool is broadly similar
 * to Bing/Google for head and long-tail queries.
 *
 * Output: scripts/keyword-research/output/serp-raw.json
 *
 * Usage:
 *   node scripts/keyword-research/harvest-serp.js [maxQueries]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, 'output');
const IN_FILE = path.join(OUT_DIR, 'keywords-filtered.json');
const OUT_FILE = path.join(OUT_DIR, 'serp-raw.json');

const MAX = parseInt(process.argv[2] || '100', 10);
const DELAY_MS = 2000;  // Bing SERP scraping — be conservative

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return reject(new Error(`redirect ${res.statusCode} -> ${res.headers.location}`));
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function unwrapDdgUrl(url) {
  // DDG wraps destination URLs as //duckduckgo.com/l/?uddg=<url-encoded-dest>&rut=...
  const m = url.match(/[?&]uddg=([^&]+)/);
  if (m) {
    try { return decodeURIComponent(m[1]); } catch { return url; }
  }
  return url;
}

function extractOrganicResults(html) {
  // DDG HTML SERP: each result has <a class="result__a" href="...">TITLE</a>
  // plus a snippet in <a class="result__snippet"> nearby.
  const results = [];
  const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = linkRe.exec(html)) !== null && results.length < 10) {
    const url = unwrapDdgUrl(m[1]);
    const title = m[2].replace(/<[^>]+>/g, '').replace(/&#\d+;/g, '').replace(/&\w+;/g, ' ').trim();
    if (title) results.push({ url, title });
  }
  return results;
}

(async () => {
  if (!fs.existsSync(IN_FILE)) {
    console.error('Missing', IN_FILE, '— run aggregate-and-filter.js first.');
    process.exit(1);
  }
  const all = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
  // Only SERP-check queries that need a new page (gaps) and are high priority
  const gaps = all.filter(q => q.newPageNeeded).slice(0, MAX);

  console.log(`Scraping Bing SERPs for top ${gaps.length} gap queries`);
  console.log(`ETA: ~${Math.ceil(gaps.length * DELAY_MS / 1000 / 60)} minutes\n`);

  const output = [];
  let okCount = 0, errCount = 0;

  for (let i = 0; i < gaps.length; i++) {
    const q = gaps[i];
    const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q.query);
    try {
      const { status, body } = await fetchHtml(url);
      if (status !== 200) {
        errCount++;
        output.push({ query: q.query, vertical: q.vertical, error: `status ${status}`, results: [] });
      } else {
        const results = extractOrganicResults(body);
        output.push({ query: q.query, vertical: q.vertical, results });
        if (results.length > 0) okCount++;
        else errCount++;
      }
    } catch (e) {
      errCount++;
      output.push({ query: q.query, vertical: q.vertical, error: e.message, results: [] });
    }

    if ((i + 1) % 10 === 0 || i === gaps.length - 1) {
      process.stdout.write(`  [${i+1}/${gaps.length}] ok:${okCount} err:${errCount}\r`);
    }

    // Save incrementally
    fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
    await sleep(DELAY_MS);
  }

  console.log(`\n\nDone. Output: ${OUT_FILE}`);
})();
