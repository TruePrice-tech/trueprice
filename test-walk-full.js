const puppeteer = require('puppeteer');
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const issues = [];

  async function clickFirstOption() {
    const sels = ['.move-option', '.hvac-option', '.paint-option', '.fence-option',
                  '.est-option', '.option-btn', '[data-val]', '[data-value]', '[data-group]'];
    for (const sel of sels) {
      const opts = await page.$$(sel);
      for (const o of opts) {
        const vis = await page.evaluate(el => el.offsetParent !== null, o);
        if (vis) {
          const txt = await page.evaluate(el => el.textContent.trim().substring(0, 40), o);
          await o.click();
          return txt;
        }
      }
    }
    return null;
  }

  async function walkEstimate(name, url) {
    console.log('\n=== ' + name + ' ESTIMATE ===');
    await page.goto('https://woogoro.com' + url, { waitUntil: 'networkidle2' });

    // Fill address
    const fields = { '#addrStreet': '123 Main St', '#addrCity': 'Charlotte', '#addrState': 'NC', '#addrZip': '28202' };
    for (const [sel, val] of Object.entries(fields)) {
      const f = await page.$(sel);
      if (f) await f.type(val);
    }

    // Click submit
    await page.evaluate(() => {
      const btn = document.querySelector('#btnEstimate');
      if (btn) btn.click();
    });
    await sleep(1500);

    // Walk through steps
    for (let step = 0; step < 12; step++) {
      const picked = await clickFirstOption();
      if (picked) {
        const stepText = await page.evaluate(() => (document.body.innerText.match(/Step \d+ of \d+/) || [''])[0]);
        console.log('  ' + stepText + ' -> ' + picked);
        await sleep(1200);
      } else {
        // Try filling any visible empty inputs
        const filled = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type=text], input[type=number]'));
          let count = 0;
          for (const inp of inputs) {
            if (inp.offsetParent && !inp.value && !inp.id.startsWith('addr')) {
              inp.value = '2000';
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              count++;
            }
          }
          return count;
        });
        if (filled > 0) console.log('  Filled ' + filled + ' input(s)');
        await sleep(500);
      }

      // Check if results appeared
      const resultCheck = await page.evaluate(() => {
        const footer = document.querySelector('.tp-result-footer');
        const prices = document.body.innerText.match(/\$[\d,]+/g);
        const hasRange = /\$[\d,]+\s*[-–]\s*\$[\d,]+/.test(document.body.innerText);
        return { footer: !!footer, prices: (prices || []).length, hasRange };
      });

      if (resultCheck.hasRange || resultCheck.prices > 3) {
        console.log('  RESULTS: ' + resultCheck.prices + ' prices, range=' + resultCheck.hasRange);
        if (resultCheck.footer) {
          const labels = await page.$$eval('.tp-result-footer .tp-action-label', els => els.map(e => e.textContent.trim()));
          console.log('  FOOTER: ' + JSON.stringify(labels));
          const thumbs = (await page.$$('.tp-result-footer .tp-thumb')).length;
          console.log('  THUMBS: ' + thumbs + '/2');
        } else {
          console.log('  ISSUE: No result footer!');
          issues.push(name + ' estimate: no result footer after results');
        }
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        await page.screenshot({ path: 'test-results/' + slug + '-estimate-full.png', fullPage: true });
        return;
      }
    }
    console.log('  ISSUE: Never reached results after 12 steps');
    issues.push(name + ' estimate: never reached results');
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    await page.screenshot({ path: 'test-results/' + slug + '-estimate-stuck.png', fullPage: true });
  }

  // Walk all 4 verticals (auto repair is different - skip estimate path)
  await walkEstimate('Moving', '/moving-estimate.html');
  await walkEstimate('HVAC', '/hvac-estimate.html');
  await walkEstimate('Fencing', '/fencing-estimate.html');
  await walkEstimate('Painting', '/painting-estimate.html');

  // Auto repair - check the analyze link destination
  console.log('\n=== AUTO REPAIR ANALYZE PATH ===');
  await page.goto('https://woogoro.com/auto-repair.html', { waitUntil: 'networkidle2' });
  const analyzeHref = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a')).find(a => /Analyze a quote/i.test(a.textContent));
    return link ? link.href : 'not found';
  });
  console.log('  "Analyze a quote" links to: ' + analyzeHref);

  // Check if there is a quote analysis mode on the auto repair page
  const pathBtns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[id*="path"], [data-mode]')).map(el => ({
      id: el.id, text: el.textContent.trim().substring(0, 40), tag: el.tagName
    }));
  });
  console.log('  Path buttons: ' + JSON.stringify(pathBtns));

  // Click the quote path button if it exists
  const quotePath = await page.$('#pathQuoteBtn');
  if (quotePath) {
    await quotePath.click();
    await sleep(1000);
    const hasUploadNow = await page.$('#dropZone, input[type="file"]');
    console.log('  After clicking quote path: upload=' + !!hasUploadNow);
    if (hasUploadNow) console.log('  Auto repair DOES have upload - just behind a tab');
    else {
      console.log('  ISSUE: No upload area even after quote path click');
      issues.push('Auto repair: no upload area even after pathQuoteBtn click');
    }
  }
  await page.screenshot({ path: 'test-results/auto-repair-quote-path.png', fullPage: true });

  await browser.close();

  console.log('\n\n========================================');
  console.log('FINAL SUMMARY');
  console.log('========================================');
  console.log('Issues: ' + issues.length);
  if (issues.length === 0) console.log('  ALL CLEAR');
  else issues.forEach((iss, i) => console.log('  ' + (i+1) + '. ' + iss));
})();
