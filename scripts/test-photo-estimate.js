#!/usr/bin/env node
/**
 * scripts/test-photo-estimate.js
 *
 * Phase C extension: roofing photo-estimate journey using a real house image.
 *
 * Visits /photo-estimate.html, fills the address form, advances to the
 * photo capture step, uploads test-images/17064Laurelmont.jpg, waits for
 * the Claude vision call to return roof characteristics, verifies the
 * result renders without errors.
 *
 * Run: node scripts/test-photo-estimate.js
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const RESULTS_DIR = path.join(ROOT, 'test-results');
const SHOTS_DIR = path.join(RESULTS_DIR, 'photo-estimate-screens');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const HOUSE_IMG = path.join(ROOT, 'test-images', '17064Laurelmont.jpg');
const URL = 'https://truepricehq.com/photo-estimate.html';

(async () => {
  if (!fs.existsSync(HOUSE_IMG)) {
    console.error('FAIL: test-images/17064Laurelmont.jpg not found');
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1280, height: 900 });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.substring(0, 250)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().substring(0, 250)); });

  const report = {
    test: 'roofing photo estimate',
    url: URL,
    image: '17064Laurelmont.jpg',
    pageLoaded: false,
    addressStepRendered: false,
    advancedToCapture: false,
    fileInputFound: false,
    uploaded: false,
    waitedSeconds: 0,
    resultRendered: false,
    extractedRoofData: null,
    errors: [],
    notes: [],
  };

  try {
    const resp = await page.goto(URL, { waitUntil: 'networkidle2' });
    report.pageLoaded = resp && resp.status() === 200;
    await new Promise(r => setTimeout(r, 1500));

    // Check if address step is rendered first
    const addrCheck = await page.evaluate(() => {
      const addrInputs = document.querySelectorAll('input[id*="addr" i], input[placeholder*="city" i], input[placeholder*="state" i]');
      const photoBtn = document.body.innerText.toLowerCase().indexOf('take photo') !== -1 || document.body.innerText.toLowerCase().indexOf('snap a photo') !== -1;
      return { hasAddrInputs: addrInputs.length > 0, addrCount: addrInputs.length, hasPhotoBtnFirst: photoBtn };
    });
    report.addressStepRendered = addrCheck.hasAddrInputs;
    report.notes.push('address inputs visible: ' + addrCheck.addrCount + ', photo btn visible: ' + addrCheck.hasPhotoBtnFirst);

    if (addrCheck.hasAddrInputs) {
      // Fill address form
      const cityInput = await page.$('input[id*="City" i], input[placeholder*="city" i]');
      if (cityInput) await cityInput.type('Charlotte');
      const stateInput = await page.$('input[id*="State" i], input[placeholder*="state" i]');
      if (stateInput) await stateInput.type('NC');
      const zipInput = await page.$('input[id*="Zip" i], input[placeholder*="zip" i]');
      if (zipInput) await zipInput.type('28202');
      await page.screenshot({ path: path.join(SHOTS_DIR, '01-address-filled.png') });
      // Click Continue
      const clicked = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        for (const b of buttons) {
          const t = (b.textContent || '').toLowerCase();
          if (t.indexOf('continue') !== -1 || t.indexOf('next') !== -1) { b.click(); return true; }
        }
        return false;
      });
      if (!clicked) report.notes.push('no continue button found after address');
      await new Promise(r => setTimeout(r, 1500));
    }

    // Now look for photo capture / file input
    const photoState = await page.evaluate(() => {
      const fileInput = document.querySelector('input[type="file"]');
      const photoBtn = document.body.innerText.toLowerCase().indexOf('take photo') !== -1;
      return { hasFileInput: !!fileInput, photoBtnVisible: photoBtn };
    });
    report.advancedToCapture = photoState.hasFileInput || photoState.photoBtnVisible;
    await page.screenshot({ path: path.join(SHOTS_DIR, '02-capture-step.png') });

    if (photoState.hasFileInput) {
      const fi = await page.$('input[type="file"]');
      report.fileInputFound = true;
      await fi.uploadFile(HOUSE_IMG);
      report.uploaded = true;

      // Wait for result
      const start = Date.now();
      const maxWait = 120000; // 2 min
      let found = false;
      let extracted = null;
      while (Date.now() - start < maxWait) {
        const status = await page.evaluate(() => {
          const txt = document.body.innerText || '';
          const lc = txt.toLowerCase();
          // Look for roof characteristic keywords
          const hasRoof = /roof size|sq ft|square feet|architectural|asphalt|metal|tile|shingle|estimate|pitch|slope/.test(lc);
          const hasDollar = /\$\d[\d,]*/.test(txt);
          if (hasRoof && hasDollar) {
            const dollars = (txt.match(/\$\d[\d,]*/g) || []).slice(0, 5);
            return { ready: true, dollars, snippet: txt.substring(0, 600) };
          }
          return { ready: false };
        });
        if (status.ready) { found = true; extracted = status; break; }
        await new Promise(r => setTimeout(r, 2000));
      }
      report.waitedSeconds = Math.round((Date.now() - start) / 1000);
      report.resultRendered = found;
      report.extractedRoofData = extracted;
      await page.screenshot({ path: path.join(SHOTS_DIR, '03-result.png'), fullPage: false });
    }
  } catch (e) {
    report.notes.push('exception: ' + e.message.substring(0, 200));
  }
  report.errors = errors.slice(0, 10);
  await browser.close();

  const out = path.join(RESULTS_DIR, 'photo-estimate-' + new Date().toISOString().slice(0,10) + '.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('saved: ' + out);
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error(e); process.exit(2); });
