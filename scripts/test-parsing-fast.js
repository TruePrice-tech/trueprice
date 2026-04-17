#!/usr/bin/env node
/**
 * scripts/test-parsing-fast.js
 *
 * Parallel parser test. Opens all 16 verticals concurrently in one
 * browser, uploads a fixture to each, captures state at 5s/15s/30s
 * checkpoints, and reports without waiting the full 90s.
 *
 * Total runtime: ~45s (vs ~16-24 min for the sequential version).
 *
 * Trade-off: more flaky (concurrent OCR + Claude calls) but good
 * enough for a smoke test to know if a fix landed.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const RESULTS_DIR = path.join(ROOT, 'test-results');
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const BASE = 'https://woogoro.com';
const UNIVERSAL_FALLBACK = path.join(ROOT, 'test-images', 'Trudy comparing1.png');

const VERTICALS = [
  { v: 'hvac' },
  { v: 'plumbing' },
  { v: 'electrical' },
  { v: 'roofing' },
  { v: 'solar' },
  { v: 'concrete' },
  { v: 'window', folder: 'windows-images' },
  { v: 'siding' },
  { v: 'painting' },
  { v: 'foundation' },
  { v: 'fencing' },
  { v: 'gutters' },
  { v: 'insulation' },
  { v: 'kitchen' },
  { v: 'landscaping' },
  { v: 'garage-door' },
];

function pickFixture(v) {
  const folder = v.folder || (v.v + '-images');
  const dir = path.join(ROOT, 'test-quotes', folder);
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => /\.(png|jpe?g)$/i.test(f) && !/^messy-/.test(f) && !/^comparison-/.test(f));
    // Prefer larger files (real photos > thumbnails > mocks)
    files.sort((a, b) => {
      const sa = fs.statSync(path.join(dir, a)).size;
      const sb = fs.statSync(path.join(dir, b)).size;
      return sb - sa;
    });
    if (files.length) return { path: path.join(dir, files[0]), name: files[0] };
  }
  if (fs.existsSync(UNIVERSAL_FALLBACK)) return { path: UNIVERSAL_FALLBACK, name: 'Trudy comparing1.png' };
  return null;
}

function analyzerUrl(v) {
  if (v.v === 'roofing') return BASE + '/roofing-quote-analyzer.html?path=quote&cb=' + Date.now();
  if (v.v === 'window') return BASE + '/window-quote-analyzer.html?path=quote&cb=' + Date.now();
  return BASE + '/' + v.v + '-quote-analyzer.html?path=quote&cb=' + Date.now();
}

async function testOne(browser, v) {
  const fixture = pickFixture(v);
  const result = {
    vertical: v.v,
    fixture: fixture ? fixture.name : null,
    pageLoaded: false,
    uploaded: false,
    checkpoint5s: null,
    checkpoint15s: null,
    checkpoint30s: null,
    finalState: null,
    consoleErrors: [],
    pass: false,
  };
  if (!fixture) { result.note = 'no fixture'; return result; }

  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => result.consoleErrors.push('pageerror: ' + e.message.substring(0, 150)));
  page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push('err: ' + m.text().substring(0, 150)); });
  await page.setViewport({ width: 1280, height: 900 });
  try {
    const resp = await page.goto(analyzerUrl(v), { waitUntil: 'domcontentloaded', timeout: 15000 });
    result.pageLoaded = resp && resp.status() === 200;
    await new Promise(r => setTimeout(r, 1200));
    // Try to find a file input
    const fi = await page.$('input[type="file"]');
    if (!fi) { result.note = 'no file input'; await page.close(); return result; }
    await fi.uploadFile(fixture.path);
    result.uploaded = true;
    // Force change event for hidden file inputs
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="file"]');
      for (const i of inputs) i.dispatchEvent(new Event('change', { bubbles: true }));
    }).catch(() => {});

    const captureState = async () => {
      return await page.evaluate(() => {
        const txt = document.body.innerText || '';
        const dollarMatches = (txt.match(/\$\d[\d,]*/g) || []).slice(0, 3);
        const hasVerdict = /verdict|fair|above|below|too high|too low|estimated cost|red flag|scope/i.test(txt);
        return { dollars: dollarMatches, hasVerdict, len: txt.length };
      });
    };

    await new Promise(r => setTimeout(r, 5000));
    result.checkpoint5s = await captureState();
    await new Promise(r => setTimeout(r, 10000));
    result.checkpoint15s = await captureState();
    await new Promise(r => setTimeout(r, 15000));
    result.checkpoint30s = await captureState();
    result.finalState = result.checkpoint30s;
    result.pass = !!(result.checkpoint30s && result.checkpoint30s.hasVerdict && result.checkpoint30s.dollars.length > 0);
  } catch (e) {
    result.note = 'exception: ' + e.message.substring(0, 150);
  }
  await page.close();
  return result;
}

(async () => {
  console.log('Fast parallel parser test on ' + VERTICALS.length + ' verticals...');
  const start = Date.now();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const results = await Promise.all(VERTICALS.map(v => testOne(browser, v)));
  await browser.close();
  const elapsed = Math.round((Date.now() - start) / 1000);

  console.log('\nResults (' + elapsed + 's):');
  for (const r of results) {
    const tag = r.pass ? 'PASS' : (r.finalState && r.finalState.hasVerdict ? 'WARN' : 'FAIL');
    const fState = r.finalState || {};
    console.log(' ' + tag.padEnd(5) + ' ' + r.vertical.padEnd(14)
      + ' fixture=' + (r.fixture || 'none').substring(0, 30).padEnd(30)
      + ' verdict=' + (fState.hasVerdict ? 'yes' : 'no ').padEnd(4)
      + ' $=' + ((fState.dollars || []).join(',') || 'none').padEnd(20)
      + (r.note ? ' :: ' + r.note : '')
      + (r.consoleErrors.length ? ' [' + r.consoleErrors.length + ' err]' : ''));
  }
  const passes = results.filter(r => r.pass).length;
  const warns = results.filter(r => !r.pass && r.finalState && r.finalState.hasVerdict).length;
  const fails = results.filter(r => !r.pass && !(r.finalState && r.finalState.hasVerdict)).length;
  console.log('\nPASS: ' + passes + ' / WARN: ' + warns + ' / FAIL: ' + fails + ' / total: ' + results.length);

  fs.writeFileSync(path.join(RESULTS_DIR, 'parsing-fast-' + new Date().toISOString().slice(0,10) + '.json'), JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exit(2); });
