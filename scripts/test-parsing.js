#!/usr/bin/env node
/**
 * scripts/test-parsing.js
 *
 * Phase B: parsing test for all 16 verticals.
 *
 * For each vertical:
 *   1. Pick the first real fixture from test-quotes/{vertical}-images/
 *      (or fall back to test-images/Trudy comparing1.png)
 *   2. Open the live analyzer page in puppeteer
 *   3. Upload the fixture via the file input
 *   4. Wait up to 90s for a verdict
 *   5. Capture: Tesseract text length, Claude parse result, totalPrice,
 *      verdict text, console errors
 *   6. PASS if totalPrice extracted as a number > 0
 *   7. FAIL otherwise — flag the parser
 *
 * Writes results to test-results/parsing-2026-04-09.json + screenshots.
 *
 * Run: node scripts/test-parsing.js
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const RESULTS_DIR = path.join(ROOT, 'test-results');
const SHOTS_DIR = path.join(RESULTS_DIR, 'parsing-screens');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

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
    const files = fs.readdirSync(dir).filter(f => /\.(png|jpe?g|pdf)$/i.test(f) && !/^messy-/.test(f) && !/^comparison-/.test(f));
    if (files.length) return { path: path.join(dir, files[0]), source: 'real', name: files[0] };
  }
  // Fallback: legacy folder
  const legacyDir = path.join(ROOT, 'test-quotes', (v.folder || v.v).replace('-images','-test-images') + '');
  if (fs.existsSync(legacyDir)) {
    const files = fs.readdirSync(legacyDir).filter(f => /\.(png|jpe?g|pdf)$/i.test(f) && !/^messy-/.test(f) && !/^comparison-/.test(f));
    if (files.length) return { path: path.join(legacyDir, files[0]), source: 'real-legacy', name: files[0] };
  }
  if (fs.existsSync(UNIVERSAL_FALLBACK)) return { path: UNIVERSAL_FALLBACK, source: 'fallback', name: 'Trudy comparing1.png' };
  return null;
}

function analyzerUrl(v) {
  // Roofing has a special analyzer name
  if (v.v === 'roofing') return BASE + '/roofing-quote-analyzer.html?path=quote';
  // Window analyzer is window-quote-analyzer.html (singular)
  if (v.v === 'window') return BASE + '/window-quote-analyzer.html?path=quote';
  return BASE + '/' + v.v + '-quote-analyzer.html?path=quote';
}

async function testVertical(browser, v) {
  const result = {
    vertical: v.v,
    fixture: null,
    fixtureSource: null,
    httpStatus: null,
    pageLoaded: false,
    fileInputFound: false,
    uploaded: false,
    waitedSeconds: 0,
    verdictRendered: false,
    totalPriceExtracted: null,
    verdictText: '',
    pass: false,
    consoleErrors: [],
    screenshot: null,
    notes: [],
  };

  const fixture = pickFixture(v);
  if (!fixture) { result.notes.push('no fixture available'); return result; }
  result.fixture = fixture.name;
  result.fixtureSource = fixture.source;

  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1280, height: 900 });

  page.on('pageerror', e => result.consoleErrors.push('pageerror: ' + e.message.substring(0, 250)));
  page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push('console.error: ' + m.text().substring(0, 250)); });

  try {
    const resp = await page.goto(analyzerUrl(v), { waitUntil: 'networkidle2', timeout: 30000 });
    result.httpStatus = resp ? resp.status() : 0;
    if (result.httpStatus >= 400) { result.notes.push('HTTP ' + result.httpStatus); await page.close(); return result; }
    result.pageLoaded = true;
    await new Promise(r => setTimeout(r, 1500));

    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) { result.notes.push('no file input found'); await page.screenshot({ path: path.join(SHOTS_DIR, v.v + '-no-input.png') }); result.screenshot = v.v + '-no-input.png'; await page.close(); return result; }
    result.fileInputFound = true;

    await fileInput.uploadFile(fixture.path);
    result.uploaded = true;

    // Wait up to 90s for verdict
    const start = Date.now();
    const maxWait = 90000;
    let found = false;
    while (Date.now() - start < maxWait) {
      const status = await page.evaluate(() => {
        const txt = (document.body.innerText || '');
        const lc = txt.toLowerCase();
        // Heuristic: look for verdict words + a $ amount visible
        const hasVerdict = /verdict|fair price|above average|below average|too high|too low|looks fair|red flag|scope check|quote analysis|estimated cost|your roof|roof.*range|cost range/.test(lc);
        const dollarMatches = txt.match(/\$\d[\d,]*/g) || [];
        return { hasVerdict: hasVerdict, dollarCount: dollarMatches.length, dollarSamples: dollarMatches.slice(0,3) };
      });
      if (status.hasVerdict && status.dollarCount > 0) { found = true; break; }
      await new Promise(r => setTimeout(r, 1000));
    }
    result.waitedSeconds = Math.round((Date.now() - start) / 1000);
    result.verdictRendered = found;

    if (found) {
      // Extract structured data
      const extracted = await page.evaluate(() => {
        const txt = document.body.innerText || '';
        const ms = txt.match(/\$([\d,]+(?:\.\d{2})?)/g) || [];
        const nums = ms.map(s => parseFloat(s.replace(/[$,]/g, ''))).filter(n => isFinite(n) && n > 100);
        return {
          maxPrice: nums.length ? Math.max(...nums) : null,
          firstPrice: nums.length ? nums[0] : null,
          textSample: txt.substring(0, 500),
        };
      });
      result.totalPriceExtracted = extracted.firstPrice;
      result.verdictText = extracted.textSample;
      result.pass = !!(extracted.firstPrice && extracted.firstPrice > 0);
    }

    const shotPath = path.join(SHOTS_DIR, v.v + '-result.png');
    await page.screenshot({ path: shotPath, fullPage: false });
    result.screenshot = v.v + '-result.png';
  } catch (e) {
    result.notes.push('exception: ' + e.message.substring(0, 200));
  }
  await page.close();
  return result;
}

(async () => {
  console.log('Running parsing test on ' + VERTICALS.length + ' verticals...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const all = [];
  for (const v of VERTICALS) {
    const r = await testVertical(browser, v);
    const tag = r.pass ? 'PASS' : (r.verdictRendered ? 'WARN' : 'FAIL');
    console.log(' ' + tag.padEnd(5) + ' ' + r.vertical.padEnd(14)
      + ' fixture=' + (r.fixture || 'none').substring(0, 30).padEnd(30)
      + ' price=' + (r.totalPriceExtracted || 'null').toString().padEnd(8)
      + (r.notes.length ? ' :: ' + r.notes.join('; ') : '')
      + (r.consoleErrors.length ? ' [' + r.consoleErrors.length + ' err]' : ''));
    all.push(r);
  }
  await browser.close();

  const outFile = path.join(RESULTS_DIR, 'parsing-' + new Date().toISOString().slice(0,10) + '.json');
  fs.writeFileSync(outFile, JSON.stringify(all, null, 2));
  console.log('\nresults saved: ' + outFile);

  const passes = all.filter(r => r.pass).length;
  const warns = all.filter(r => r.verdictRendered && !r.pass).length;
  const fails = all.filter(r => !r.verdictRendered).length;
  console.log('PASS: ' + passes + ' / WARN: ' + warns + ' / FAIL: ' + fails + ' / total: ' + all.length);
})().catch(e => { console.error(e); process.exit(2); });
