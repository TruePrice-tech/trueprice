#!/usr/bin/env node
/**
 * Pushes all URLs from sitemap-index.xml to Bing/Yandex via IndexNow.
 * Bing accepts up to 10,000 URLs per batch. We chunk accordingly.
 *
 * Usage:
 *   node scripts/indexnow-push.js                 # push everything in sitemap-index.xml
 *   node scripts/indexnow-push.js <url> <url> ... # push specific URLs only
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = '998500a3bd45aa35665eeda2a8cc6057';
const HOST = 'woogoro.com';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const BATCH_SIZE = 10000;

function readFileIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function extractLocs(xml) {
  if (!xml) return [];
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) locs.push(m[1]);
  return locs;
}

function collectUrlsFromSitemaps(rootDir) {
  const indexPath = path.join(rootDir, 'sitemap-index.xml');
  const indexXml = readFileIfExists(indexPath);
  if (!indexXml) {
    console.error(`Missing ${indexPath}`);
    process.exit(1);
  }
  const sitemapUrls = extractLocs(indexXml);
  const urls = new Set();
  for (const smUrl of sitemapUrls) {
    const filename = smUrl.split('/').pop();
    const localPath = path.join(rootDir, filename);
    const xml = readFileIfExists(localPath);
    if (!xml) {
      console.warn(`Sub-sitemap not found locally: ${filename} (skipping)`);
      continue;
    }
    for (const u of extractLocs(xml)) urls.add(u);
  }
  return Array.from(urls);
}

function postBatch(urls) {
  const body = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  });
  return new Promise((resolve, reject) => {
    const req = https.request(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const argUrls = process.argv.slice(2).filter(Boolean);
  const urls = argUrls.length ? argUrls : collectUrlsFromSitemaps(rootDir);

  if (!urls.length) {
    console.error('No URLs to push.');
    process.exit(1);
  }

  console.log(`Pushing ${urls.length} URLs to IndexNow (key: ${KEY.slice(0, 6)}...)`);

  let pushed = 0;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const res = await postBatch(batch);
    pushed += batch.length;
    console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} URLs → HTTP ${res.status}`);
    if (res.status >= 400) {
      console.error(`  response: ${res.body}`);
    }
  }
  console.log(`Done. ${pushed}/${urls.length} URLs submitted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
