#!/usr/bin/env node
/**
 * Pull Bing Webmaster Tools data via their XML API. Stub now — requires
 * a BWT API key set in BWT_API_KEY env var. Lane generates this in BWT
 * settings → Settings & Security → API Access.
 *
 * Once configured, returns: { scoredAt, topQueries, topPages, crawlStats,
 *   indexedCount, errors }
 *
 * BWT API docs: https://learn.microsoft.com/en-us/bingwebmaster/
 */

const https = require('https');

const SITE_URL = 'https://woogoro.com/';
const API_KEY = process.env.BWT_API_KEY || null;

function bwtCall(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!API_KEY) return reject(new Error('BWT_API_KEY not set'));
    const qs = new URLSearchParams({ apikey: API_KEY, siteUrl: SITE_URL, ...params });
    const url = `https://ssl.bing.com/webmaster/api.svc/json/${method}?${qs.toString()}`;
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse fail: ${data.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

async function collect() {
  const result = {
    scoredAt: new Date().toISOString(),
    configured: !!API_KEY,
    topQueries: [],
    topPages: [],
    crawlStats: null,
    error: null,
  };

  if (!API_KEY) {
    result.error = 'BWT_API_KEY not set. Generate at https://www.bing.com/webmasters/ → Settings & Security → API Access. Set as env var or .env file.';
    return result;
  }

  try {
    // Top queries (last 7 days)
    const queries = await bwtCall('GetQueryStats');
    result.topQueries = (queries.d || []).slice(0, 50).map(q => ({
      query: q.Query,
      impressions: q.Impressions,
      clicks: q.Clicks,
      avgImpressionPosition: q.AvgImpressionPosition,
      avgClickPosition: q.AvgClickPosition,
    }));

    // Top pages
    const pages = await bwtCall('GetPageStats');
    result.topPages = (pages.d || []).slice(0, 50).map(p => ({
      page: p.Page,
      impressions: p.Impressions,
      clicks: p.Clicks,
    }));

    // Crawl stats
    const crawl = await bwtCall('GetCrawlStats');
    result.crawlStats = crawl.d || null;
  } catch (e) {
    result.error = e.message;
  }

  return result;
}

if (require.main === module) {
  collect().then(out => console.log(JSON.stringify(out, null, 2)));
}

module.exports = { collect };
