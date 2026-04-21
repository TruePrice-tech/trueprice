#!/usr/bin/env node
/**
 * Pull approximate indexation count from Bing's site: query. Bing returns
 * an estimate of indexed pages on the SERP HTML. Crude but useful as a
 * trend signal — track over time to spot indexation gains or de-indexation.
 *
 * Returns: { scoredAt, source, indexedCount, sitemapCount, gap }
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractIndexedCount(html) {
  // DDG / Bing both report "About X results" in the SERP. DDG's HTML SERP
  // doesn't always report the count, so fall back to known patterns.
  const patterns = [
    /About\s+([\d,]+)\s+results?/i,
    /(\d{1,3}(?:[,\.]\d{3})+)\s+results?/i,
    /Showing\s+\d+\s+of\s+([\d,]+)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return parseInt(m[1].replace(/[,\.]/g, ''), 10);
  }
  return null;
}

function countSitemapUrls() {
  // Walk sitemap-index.xml and sum <url><loc> entries from each sub-sitemap
  const indexPath = path.join(ROOT, 'sitemap-index.xml');
  if (!fs.existsSync(indexPath)) return null;
  const indexXml = fs.readFileSync(indexPath, 'utf8');
  const subs = [...indexXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].split('/').pop());
  let total = 0;
  const seen = new Set();
  for (const sub of subs) {
    const subPath = path.join(ROOT, sub);
    if (!fs.existsSync(subPath)) continue;
    const sx = fs.readFileSync(subPath, 'utf8');
    for (const m of sx.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      if (!seen.has(m[1])) { seen.add(m[1]); total++; }
    }
  }
  return total;
}

async function collect() {
  const result = { scoredAt: new Date().toISOString(), source: 'duckduckgo', indexedCount: null, sitemapCount: null, gap: null, error: null };

  result.sitemapCount = countSitemapUrls();

  try {
    const url = 'https://html.duckduckgo.com/html/?q=site%3Awoogoro.com';
    const { status, body } = await fetchHtml(url);
    if (status === 200) {
      result.indexedCount = extractIndexedCount(body);
    } else {
      result.error = `HTTP ${status}`;
    }
  } catch (e) {
    result.error = e.message;
  }

  if (result.indexedCount != null && result.sitemapCount != null) {
    result.gap = result.sitemapCount - result.indexedCount;
    result.indexationRate = +(result.indexedCount / result.sitemapCount * 100).toFixed(1);
  }

  return result;
}

if (require.main === module) {
  collect().then(out => console.log(JSON.stringify(out, null, 2)));
}

module.exports = { collect };
