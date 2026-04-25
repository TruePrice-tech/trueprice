const puppeteer = require('puppeteer');
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.setDefaultTimeout(15000);
  if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

  const BASE = 'https://woogoro.com';
  const issues = [];

  function log(msg) { console.log(msg); }
  function fail(msg) { issues.push(msg); console.log('  ISSUE: ' + msg); }

  async function has(sel, timeout) {
    try {
      await page.waitForSelector(sel, { timeout: timeout || 6000 });
      return true;
    } catch(e) { return false; }
  }

  async function testVertical(name, slug, analyzerUrl, estimateUrl, compareUrl) {
    log('\n========== ' + name.toUpperCase() + ' ==========');

    // PATH 1: ESTIMATE
    log('\n  --- Path 1: Estimate ---');
    await page.goto(BASE + estimateUrl, { waitUntil: 'networkidle2' });
    log('  URL: ' + page.url());
    const t1 = await page.title();
    log('  Title: ' + t1);
    if (!t1 || t1.includes('404')) fail(name + ' estimate page 404');

    // Check form elements
    const hasAddr = await has('#addressInput, #estAddress, input[placeholder*="address" i]');
    const hasFormEls = await has('input, select, .est-option, button');
    if (!hasAddr && !hasFormEls) fail(name + ' estimate: no form found');
    else log('  Form: address=' + hasAddr + ' elements=' + hasFormEls);

    // Submit button
    const submitBtns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().substring(0, 50)).filter(t => /build|estimate|get|calculate|submit/i.test(t));
    });
    if (submitBtns.length > 0) log('  Submit: "' + submitBtns[0] + '"');
    else fail(name + ' estimate: no submit button');

    // Cross-link to analyze
    const analyzeLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).filter(a => /upload|analyze|already have/i.test(a.textContent)).map(a => a.textContent.trim().substring(0, 60));
    });
    if (analyzeLinks.length > 0) log('  Cross-link: "' + analyzeLinks[0] + '"');
    else log('  No cross-link to analyze path');

    await page.screenshot({ path: 'test-results/' + slug + '-estimate.png', fullPage: true });

    // PATH 2: ANALYZE
    log('\n  --- Path 2: Analyze ---');
    await page.goto(BASE + analyzerUrl, { waitUntil: 'networkidle2' });
    log('  URL: ' + page.url());
    const t2 = await page.title();
    log('  Title: ' + t2);
    if (!t2 || t2.includes('404')) fail(name + ' analyzer page 404');

    const hasUpload = await has('#dropZone, .upload-area, .drop-zone, .analyzer-upload, input[type="file"]');
    if (!hasUpload) fail(name + ' analyze: no upload area');
    else log('  Upload area: present');

    const hasToggle = await has('.mode-toggle, [data-mode], .analyzer-mode, .tab-btn, .intent-toggle');
    log('  Mode toggle (est/analyze): ' + hasToggle);

    const cmpLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).filter(a => /compare/i.test(a.textContent) || /compare/i.test(a.href)).map(a => a.textContent.trim().substring(0, 60));
    });
    if (cmpLinks.length > 0) log('  Cross-link to compare: "' + cmpLinks[0] + '"');
    else log('  No cross-link to compare');

    await page.screenshot({ path: 'test-results/' + slug + '-analyze.png', fullPage: true });

    // PATH 3: COMPARE
    log('\n  --- Path 3: Compare ---');
    await page.goto(BASE + compareUrl, { waitUntil: 'networkidle2' });
    log('  URL: ' + page.url());
    const t3 = await page.title();
    log('  Title: ' + t3);
    if (!t3 || t3.includes('404')) fail(name + ' compare page 404');

    const hasSlots = await has('.cmp-slot, .cq-slot, [id="slot0"], .slot');
    if (!hasSlots) fail(name + ' compare: no upload slots');
    else log('  Upload slots: present');

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

    // Check for back link to analyzer
    const backLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).filter(a => /analyzer|single|analyze/i.test(a.href)).map(a => a.textContent.trim().substring(0, 60));
    });
    if (backLinks.length > 0) log('  Back to analyzer link: "' + backLinks[0] + '"');

    await page.screenshot({ path: 'test-results/' + slug + '-compare.png', fullPage: true });
  }

  // --- Homepage check ---
  log('=== HOMEPAGE ===');
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  log('Loaded: ' + page.url());
  const heroCards = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).filter(a => a.href && /hvac|painting|fencing|auto|moving|roofing|plumbing|electrical|solar/i.test(a.href) && !a.href.includes('#')).map(a => ({text: a.textContent.trim().substring(0, 40), href: a.href.replace('https://woogoro.com', '')})).slice(0, 25);
  });
  log('Vertical links: ' + heroCards.length);
  heroCards.forEach(l => log('  ' + l.text + ' -> ' + l.href));
  await page.screenshot({ path: 'test-results/homepage.png', fullPage: false });

  // --- Check "Get an estimate" landing ---
  log('\n=== GET-AN-ESTIMATE LANDING ===');
  await page.goto(BASE + '/get-an-estimate.html', { waitUntil: 'networkidle2' });
  log('URL: ' + page.url());
  const estLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).filter(a => /estimator|estimate/i.test(a.href)).map(a => ({text: a.textContent.trim().substring(0, 40), href: a.href.replace('https://woogoro.com', '')}));
  });
  log('Estimate links: ' + estLinks.length);
  estLinks.slice(0, 10).forEach(l => log('  ' + l.text + ' -> ' + l.href));

  // --- Check "Analyze my quote" landing ---
  log('\n=== ANALYZE-MY-QUOTE LANDING ===');
  await page.goto(BASE + '/analyze-my-quote.html', { waitUntil: 'networkidle2' });
  log('URL: ' + page.url());
  const anaLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).filter(a => /analyzer/i.test(a.href)).map(a => ({text: a.textContent.trim().substring(0, 40), href: a.href.replace('https://woogoro.com', '')}));
  });
  log('Analyzer links: ' + anaLinks.length);
  anaLinks.slice(0, 10).forEach(l => log('  ' + l.text + ' -> ' + l.href));

  // --- Check "Compare quotes" picker ---
  log('\n=== COMPARE-QUOTES-PICKER ===');
  await page.goto(BASE + '/compare-quotes-picker.html', { waitUntil: 'networkidle2' });
  log('URL: ' + page.url());
  const cmpPickLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).filter(a => /compare-.*-quotes/i.test(a.href)).map(a => ({text: a.textContent.trim().substring(0, 40), href: a.href.replace('https://woogoro.com', '')}));
  });
  log('Compare vertical links: ' + cmpPickLinks.length);
  cmpPickLinks.slice(0, 10).forEach(l => log('  ' + l.text + ' -> ' + l.href));

  // Walk 5 verticals
  await testVertical('HVAC', 'hvac', '/hvac-quote-analyzer.html', '/hvac-quote-analyzer.html?mode=estimator', '/compare-hvac-quotes.html');
  await testVertical('Painting', 'painting', '/painting-quote-analyzer.html', '/painting-quote-analyzer.html?mode=estimator', '/compare-painting-quotes.html');
  await testVertical('Fencing', 'fencing', '/fencing-quote-analyzer.html', '/fencing-quote-analyzer.html?mode=estimator', '/compare-fencing-quotes.html');
  await testVertical('Auto Repair', 'auto', '/auto-repair.html', '/auto-repair.html?mode=estimator', '/compare-auto-quotes.html');
  await testVertical('Moving', 'moving', '/moving-quote-analyzer.html', '/moving-quote-analyzer.html?mode=estimator', '/compare-moving-quotes.html');

  await browser.close();

  // Summary
  log('\n\n========================================');
  log('WALK-THE-SITE SUMMARY');
  log('========================================');
  log('Verticals tested: 5 (HVAC, Painting, Fencing, Auto Repair, Moving)');
  log('Paths per vertical: 3 (estimate, analyze, compare)');
  log('Total pages walked: 15 + 3 landing pages + homepage = 19');
  log('Issues found: ' + issues.length);
  if (issues.length === 0) {
    log('  ALL CLEAR');
  } else {
    issues.forEach((iss, i) => log('  ' + (i+1) + '. ' + iss));
  }
})();
