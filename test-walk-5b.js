const puppeteer = require('puppeteer');
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.setDefaultTimeout(20000);
  if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

  const BASE = 'https://woogoro.com';
  const issues = [];

  function log(msg) { console.log(msg); }
  function fail(msg) { issues.push(msg); console.log('  ISSUE: ' + msg); }

  async function has(sel, timeout) {
    try { await page.waitForSelector(sel, { timeout: timeout || 6000 }); return true; }
    catch(e) { return false; }
  }

  async function allButtons() {
    return page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent.trim().substring(0, 60), id: b.id, visible: b.offsetParent !== null
    })).filter(b => b.visible));
  }

  // Walk ESTIMATE path end-to-end: fill minimal form, submit, check results + footer
  async function walkEstimate(name, slug, url) {
    log('\n  --- Path 1: Estimate ---');
    await page.goto(BASE + url, { waitUntil: 'networkidle2' });
    log('  URL: ' + page.url());
    log('  Title: ' + await page.title());

    const btns = await allButtons();
    const submitBtn = btns.find(b => /estimate|get|build|calculate/i.test(b.text));
    if (submitBtn) log('  Submit button: "' + submitBtn.text + '"');
    else { fail(name + ' estimate: no submit button'); return; }

    // Fill address field if present
    const addrField = await page.$('#estAddress, #addressInput, input[placeholder*="address" i]');
    if (addrField) {
      await addrField.click({ clickCount: 3 });
      await addrField.type('123 Main St, Charlotte, NC 28202');
      await sleep(1500);
      log('  Filled address');
    }

    // Fill home size if present
    const sizeField = await page.$('#estHomeSize, #homeSize, input[placeholder*="sq" i]');
    if (sizeField) {
      await sizeField.click({ clickCount: 3 });
      await sizeField.type('2000');
      log('  Filled home size: 2000');
    }

    // Click first option in each button group
    const optionGroups = await page.$$('.est-option:first-child, .option-btn:first-child');
    for (const opt of optionGroups.slice(0, 5)) {
      try { await opt.click(); await sleep(200); } catch(e) {}
    }

    // Submit
    const submitSel = submitBtn.id ? '#' + submitBtn.id : 'button';
    try {
      if (submitBtn.id) {
        await page.click('#' + submitBtn.id);
      } else {
        await page.evaluate((txt) => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith(txt.substring(0, 20)));
          if (btn) btn.click();
        }, submitBtn.text);
      }
      log('  Clicked submit');
      await sleep(5000); // Wait for estimate to render
    } catch(e) {
      fail(name + ' estimate: submit click failed - ' + e.message.substring(0, 60));
      return;
    }

    // Check for results
    const hasResult = await page.evaluate(() => {
      const body = document.body.innerText;
      return /\$[\d,]+/.test(body) && body.length > 500;
    });
    if (hasResult) log('  Results: dollar amounts visible');
    else fail(name + ' estimate: no results rendered after submit');

    // Check for result footer
    const footer = await has('.tp-result-footer', 8000);
    if (footer) {
      const footerBtns = await page.$$eval('.tp-result-footer .tp-action-label', els => els.map(e => e.textContent.trim()));
      log('  Result footer: ' + footerBtns.length + ' buttons - ' + JSON.stringify(footerBtns));
      const thumbs = await page.$$('.tp-result-footer .tp-thumb');
      log('  Feedback thumbs: ' + thumbs.length + '/2');
    } else {
      fail(name + ' estimate results: no result footer');
    }

    await page.screenshot({ path: 'test-results/' + slug + '-estimate-result.png', fullPage: false });
  }

  // Walk ANALYZE path: check upload area exists, mode toggle, cross-links
  async function walkAnalyze(name, slug, url) {
    log('\n  --- Path 2: Analyze ---');
    await page.goto(BASE + url, { waitUntil: 'networkidle2' });
    log('  URL: ' + page.url());
    log('  Title: ' + await page.title());

    const hasUpload = await has('#dropZone, .upload-area, .drop-zone, input[type="file"]');
    if (hasUpload) log('  Upload area: present');
    else fail(name + ' analyze: no upload area');

    // Check cross-links
    const links = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('a'));
      return {
        compare: all.filter(a => /compare/i.test(a.textContent) || /compare/i.test(a.href)).map(a => a.textContent.trim().substring(0, 60)),
        estimate: all.filter(a => /estimate|pricing/i.test(a.textContent)).map(a => a.textContent.trim().substring(0, 60))
      };
    });
    if (links.compare.length > 0) log('  Compare cross-link: "' + links.compare[0] + '"');
    else log('  No compare cross-link');

    await page.screenshot({ path: 'test-results/' + slug + '-analyze.png', fullPage: false });
  }

  // Walk COMPARE path: check upload slots, compare button, result-footer script
  async function walkCompare(name, slug, url) {
    log('\n  --- Path 3: Compare ---');
    await page.goto(BASE + url, { waitUntil: 'networkidle2' });
    log('  URL: ' + page.url());
    log('  Title: ' + await page.title());

    const hasSlots = await has('.cmp-slot, .cq-slot, [id="slot0"]');
    if (hasSlots) log('  Upload slots: present');
    else fail(name + ' compare: no upload slots');

    const cmpBtn = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).filter(b => /compare|upload.*2/i.test(b.textContent)).map(b => b.textContent.trim().substring(0, 60));
    });
    if (cmpBtn.length > 0) log('  Compare button: "' + cmpBtn[0] + '"');
    else fail(name + ' compare: no compare button');

    const hasFooter = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script[src]')).some(s => s.src.includes('result-footer'));
    });
    log('  result-footer.min.js: ' + (hasFooter ? 'loaded' : 'MISSING'));
    if (!hasFooter) fail(name + ' compare: result-footer.min.js not loaded');

    await page.screenshot({ path: 'test-results/' + slug + '-compare.png', fullPage: false });
  }

  // =============================================
  // 5 verticals with correct URLs
  // =============================================
  const verticals = [
    { name: 'HVAC', slug: 'hvac', estimate: '/hvac-estimate.html', analyze: '/hvac-quote-analyzer.html', compare: '/compare-hvac-quotes.html' },
    { name: 'Painting', slug: 'painting', estimate: '/painting-estimate.html', analyze: '/painting-quote-analyzer.html', compare: '/compare-painting-quotes.html' },
    { name: 'Fencing', slug: 'fencing', estimate: '/fencing-estimate.html', analyze: '/fencing-quote-analyzer.html', compare: '/compare-fencing-quotes.html' },
    { name: 'Auto Repair', slug: 'auto', estimate: '/auto-repair.html', analyze: '/auto-repair.html', compare: '/compare-auto-quotes.html' },
    { name: 'Moving', slug: 'moving', estimate: '/moving-estimate.html', analyze: '/moving-quote-analyzer.html', compare: '/compare-moving-quotes.html' },
  ];

  for (const v of verticals) {
    log('\n========== ' + v.name.toUpperCase() + ' ==========');
    await walkEstimate(v.name, v.slug, v.estimate);
    await walkAnalyze(v.name, v.slug, v.analyze);
    await walkCompare(v.name, v.slug, v.compare);
  }

  await browser.close();

  log('\n\n========================================');
  log('FULL WALK SUMMARY');
  log('========================================');
  log('Verticals: HVAC, Painting, Fencing, Auto Repair, Moving');
  log('Paths: estimate (click through to results), analyze (upload check), compare (slots + footer)');
  log('Total pages: 15');
  log('Issues: ' + issues.length);
  if (issues.length === 0) log('  ALL CLEAR');
  else issues.forEach((iss, i) => log('  ' + (i+1) + '. ' + iss));
})();
