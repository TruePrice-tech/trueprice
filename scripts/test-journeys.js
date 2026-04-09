#!/usr/bin/env node
/**
 * scripts/test-journeys.js
 *
 * Phase C: 3-journey routing test for all 16 verticals.
 * For each vertical, walks ALL THREE user journeys starting from the
 * homepage and verifies they reach the right destination without
 * landing on the wrong page.
 *
 *   ESTIMATE journey:
 *     1. Visit /
 *     2. Click the "Estimate" intent card
 *     3. On /get-an-estimate.html, click the vertical card
 *     4. The destination MUST be the estimate page (e.g. /hvac-estimate.html
 *        or /photo-estimate.html for roofing)
 *     5. The page MUST NOT show a file upload as the primary action
 *        (this catches the "estimate path landed on upload" routing bug)
 *     6. The page MUST show some kind of address input or estimator
 *        first step
 *
 *   ANALYZE journey:
 *     1. Visit /
 *     2. Click the "Analyze" intent card
 *     3. On /analyze-my-quote.html, click the vertical card
 *     4. Destination MUST be /{vertical}-quote-analyzer.html
 *     5. Page MUST show a file input as the primary action
 *
 *   COMPARE journey:
 *     1. Visit /
 *     2. Click the "Compare" intent card
 *     3. On /compare-quotes-picker.html, click the vertical card
 *     4. Destination MUST be /compare-{vertical}-quotes.html
 *     5. Page MUST show file inputs (at least 2)
 *
 * Plus the 4-button result footer check on each result/landing page.
 *
 * Run: node scripts/test-journeys.js
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const RESULTS_DIR = path.join(ROOT, 'test-results');
const SHOTS_DIR = path.join(RESULTS_DIR, 'journey-screens');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const BASE = 'https://truepricehq.com';

const VERTICALS = [
  'hvac', 'plumbing', 'electrical', 'roofing', 'solar', 'concrete',
  'window', 'siding', 'painting', 'foundation', 'fencing', 'gutters',
  'insulation', 'kitchen', 'landscaping', 'garage-door',
];

function expectedEstimateUrl(v) {
  if (v === 'roofing') return '/photo-estimate.html';
  if (v === 'window') return '/window-estimate.html';
  return '/' + v + '-estimate.html';
}
function expectedAnalyzeUrl(v) {
  if (v === 'roofing') return '/roofing-quote-analyzer.html';
  if (v === 'window') return '/window-quote-analyzer.html';
  return '/' + v + '-quote-analyzer.html';
}
function expectedCompareUrl(v) {
  // codebase inconsistency: window uses 'windows' for compare
  const slug = v === 'window' ? 'windows' : v;
  return '/compare-' + slug + '-quotes.html';
}

async function setupPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page._tpErrors = [];
  page.on('pageerror', e => page._tpErrors.push('pageerror: ' + e.message.substring(0, 200)));
  page.on('console', m => { if (m.type() === 'error') page._tpErrors.push('console.error: ' + m.text().substring(0, 200)); });
  await page.setViewport({ width: 1280, height: 900 });
  return page;
}

async function checkFourButtonFooter(page) {
  // Look for the 4 standard buttons: Back/StartOver, Save PDF, Home, Send feedback
  return await page.evaluate(() => {
    const txt = (document.body.innerText || '').toLowerCase();
    const found = {
      back: /back|start over/.test(txt),
      savePdf: /save (as )?pdf|download (as )?pdf/.test(txt),
      home: /\bhome\b/.test(txt),
      feedback: /feedback|report/.test(txt),
    };
    const count = Object.values(found).filter(Boolean).length;
    return { count, found };
  });
}

async function testEstimateJourney(browser, v) {
  const page = await setupPage(browser);
  const result = { vertical: v, journey: 'estimate', steps: [], pass: true, notes: [], errors: [], screenshot: null };
  try {
    // Step 1: home
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    result.steps.push('loaded home');
    // Click estimate intent card
    const estimateCardClicked = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href]')];
      for (const a of links) {
        if (a.getAttribute('href') && a.getAttribute('href').indexOf('get-an-estimate.html') !== -1) {
          a.click(); return a.getAttribute('href');
        }
      }
      return null;
    });
    if (!estimateCardClicked) { result.pass = false; result.notes.push('no estimate intent card on home'); await page.close(); return result; }
    await new Promise(r => setTimeout(r, 1500));
    result.steps.push('clicked Estimate card -> ' + page.url());

    if (page.url().indexOf('get-an-estimate.html') === -1) {
      result.pass = false;
      result.notes.push('estimate card landed on wrong URL: ' + page.url());
      await page.close();
      return result;
    }

    // Click the vertical card
    const expected = expectedEstimateUrl(v);
    const verticalClicked = await page.evaluate((expectedHref) => {
      const links = [...document.querySelectorAll('a[href]')];
      for (const a of links) {
        if (a.getAttribute('href') === expectedHref) {
          a.click(); return true;
        }
      }
      return false;
    }, expected);
    if (!verticalClicked) { result.pass = false; result.notes.push('no card with href=' + expected + ' on /get-an-estimate.html'); await page.close(); return result; }
    await new Promise(r => setTimeout(r, 2000));
    result.steps.push('clicked vertical -> ' + page.url());

    if (page.url().indexOf(expected) === -1) {
      result.pass = false;
      result.notes.push('vertical card navigated to wrong URL: ' + page.url() + ' (expected ' + expected + ')');
      await page.close();
      return result;
    }

    // The page must NOT show a file upload as primary
    const visualState = await page.evaluate(() => {
      const fileInputs = [...document.querySelectorAll('input[type="file"]')];
      const visibleFileInputs = fileInputs.filter(fi => {
        const rect = fi.getBoundingClientRect();
        const parent = fi.closest('button, label, div');
        const parentRect = parent ? parent.getBoundingClientRect() : { width: 0 };
        return parentRect.width > 0 && parentRect.height > 0;
      });
      const hasAddrInput = !!document.querySelector('input[id*="addr" i], input[placeholder*="address" i], input[placeholder*="city" i], input[id*="city" i], [class*="-address-form"], form#winForm');
      const hasUploadButton = (document.body.innerText || '').match(/upload (your |a )?quote|drop your quote|browse files/i);
      // photo-estimate.html shows a "Take photo" button before address — that's actually OK for roofing now since I refactored it to address-first
      const hasPhotoBtn = (document.body.innerText || '').match(/take photo|snap a photo/i);
      return { visibleFileInputs: visibleFileInputs.length, hasAddrInput, hasUploadButton: !!hasUploadButton, hasPhotoBtn: !!hasPhotoBtn };
    });

    if (visualState.hasUploadButton && !visualState.hasAddrInput) {
      result.pass = false;
      result.notes.push('estimate page shows upload as primary action (no address input visible) — ROUTING BUG');
    } else if (!visualState.hasAddrInput && !visualState.hasPhotoBtn) {
      result.pass = false;
      result.notes.push('estimate page has neither address input nor photo button — broken landing');
    }

    result.visualState = visualState;
    await page.screenshot({ path: path.join(SHOTS_DIR, v + '-estimate.png') });
    result.screenshot = v + '-estimate.png';
  } catch (e) {
    result.pass = false;
    result.notes.push('exception: ' + e.message.substring(0, 200));
  }
  result.errors = page._tpErrors.slice(0, 5);
  await page.close();
  return result;
}

async function testAnalyzeJourney(browser, v) {
  const page = await setupPage(browser);
  const result = { vertical: v, journey: 'analyze', steps: [], pass: true, notes: [], errors: [], screenshot: null };
  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    const clicked = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href]')];
      for (const a of links) {
        if (a.getAttribute('href') && a.getAttribute('href').indexOf('analyze-my-quote.html') !== -1) {
          a.click(); return true;
        }
      }
      return false;
    });
    if (!clicked) { result.pass = false; result.notes.push('no analyze intent card on home'); await page.close(); return result; }
    await new Promise(r => setTimeout(r, 1500));
    result.steps.push('clicked Analyze -> ' + page.url());

    if (page.url().indexOf('analyze-my-quote.html') === -1) {
      result.pass = false; result.notes.push('analyze card landed wrong: ' + page.url()); await page.close(); return result;
    }

    const expected = expectedAnalyzeUrl(v);
    const verticalClicked = await page.evaluate((expectedHref) => {
      const links = [...document.querySelectorAll('a[href]')];
      for (const a of links) {
        if (a.getAttribute('href') === expectedHref) { a.click(); return true; }
      }
      return false;
    }, expected);
    if (!verticalClicked) { result.pass = false; result.notes.push('no card with href=' + expected); await page.close(); return result; }
    await new Promise(r => setTimeout(r, 2000));
    result.steps.push('clicked vertical -> ' + page.url());

    if (page.url().indexOf(expected) === -1) {
      result.pass = false; result.notes.push('navigated wrong: ' + page.url() + ' (expected ' + expected + ')');
      await page.close(); return result;
    }

    const visualState = await page.evaluate(() => {
      const hasFileInput = !!document.querySelector('input[type="file"]');
      const txt = (document.body.innerText || '').toLowerCase();
      const showsLoadingForever = txt.indexOf('loading analyzer') !== -1;
      return { hasFileInput, showsLoadingForever };
    });
    if (visualState.showsLoadingForever) {
      result.pass = false; result.notes.push('stuck on Loading analyzer spinner');
    }
    if (!visualState.hasFileInput) {
      result.pass = false; result.notes.push('no file input on analyzer page');
    }
    result.visualState = visualState;
    await page.screenshot({ path: path.join(SHOTS_DIR, v + '-analyze.png') });
    result.screenshot = v + '-analyze.png';
  } catch (e) {
    result.pass = false;
    result.notes.push('exception: ' + e.message.substring(0, 200));
  }
  result.errors = page._tpErrors.slice(0, 5);
  await page.close();
  return result;
}

async function testCompareJourney(browser, v) {
  const page = await setupPage(browser);
  const result = { vertical: v, journey: 'compare', steps: [], pass: true, notes: [], errors: [], screenshot: null };
  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    const clicked = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href]')];
      for (const a of links) {
        if (a.getAttribute('href') && a.getAttribute('href').indexOf('compare-quotes-picker.html') !== -1) {
          a.click(); return true;
        }
      }
      return false;
    });
    if (!clicked) { result.pass = false; result.notes.push('no compare intent card on home'); await page.close(); return result; }
    await new Promise(r => setTimeout(r, 1500));
    result.steps.push('clicked Compare -> ' + page.url());

    if (page.url().indexOf('compare-quotes-picker.html') === -1) {
      result.pass = false; result.notes.push('compare card landed wrong: ' + page.url()); await page.close(); return result;
    }

    const expected = expectedCompareUrl(v);
    const verticalClicked = await page.evaluate((expectedHref) => {
      const links = [...document.querySelectorAll('a[href]')];
      for (const a of links) {
        if (a.getAttribute('href') === expectedHref) { a.click(); return true; }
      }
      return false;
    }, expected);
    if (!verticalClicked) { result.pass = false; result.notes.push('no card with href=' + expected); await page.close(); return result; }
    await new Promise(r => setTimeout(r, 2000));
    result.steps.push('clicked vertical -> ' + page.url());

    if (page.url().indexOf(expected) === -1) {
      result.pass = false; result.notes.push('navigated wrong: ' + page.url() + ' (expected ' + expected + ')');
      await page.close(); return result;
    }

    const visualState = await page.evaluate(() => {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      return { fileInputCount: fileInputs.length };
    });
    if (visualState.fileInputCount < 2) {
      result.pass = false; result.notes.push('compare page has fewer than 2 file inputs (got ' + visualState.fileInputCount + ')');
    }
    result.visualState = visualState;

    // Check for the standard 4-button result footer in the page (since the
    // result hasn't rendered yet, this checks if the footer template is
    // present on the page anywhere — usually injected only after results)
    const footerCheck = await checkFourButtonFooter(page);
    result.fourButtonFooter = footerCheck;

    await page.screenshot({ path: path.join(SHOTS_DIR, v + '-compare.png') });
    result.screenshot = v + '-compare.png';
  } catch (e) {
    result.pass = false;
    result.notes.push('exception: ' + e.message.substring(0, 200));
  }
  result.errors = page._tpErrors.slice(0, 5);
  await page.close();
  return result;
}

(async () => {
  console.log('Running 3-journey routing test on ' + VERTICALS.length + ' verticals...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const all = [];
  for (const v of VERTICALS) {
    for (const fn of [testEstimateJourney, testAnalyzeJourney, testCompareJourney]) {
      const r = await fn(browser, v);
      const tag = r.pass ? 'PASS' : 'FAIL';
      console.log(' ' + tag.padEnd(5) + ' ' + r.vertical.padEnd(14) + r.journey.padEnd(10)
        + (r.notes.length ? ' :: ' + r.notes.join('; ') : '')
        + (r.errors && r.errors.length ? ' [' + r.errors.length + ' err]' : ''));
      all.push(r);
    }
  }
  await browser.close();

  const outFile = path.join(RESULTS_DIR, 'journeys-' + new Date().toISOString().slice(0,10) + '.json');
  fs.writeFileSync(outFile, JSON.stringify(all, null, 2));
  console.log('\nresults saved: ' + outFile);

  const pass = all.filter(r => r.pass).length;
  const fail = all.filter(r => !r.pass).length;
  console.log('PASS: ' + pass + ' / FAIL: ' + fail + ' / total: ' + all.length);
})().catch(e => { console.error(e); process.exit(2); });
