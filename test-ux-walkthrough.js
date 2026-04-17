const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUTDIR = 'C:/tmp';
const BASE = 'https://woogoro.com';
const FIXTURES = path.join(__dirname, 'test-quotes');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function collectErrors(page) {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

// ========== ESTIMATE PATH (multi-step wizard) ==========
async function testEstimate(browser, vertical) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = await collectErrors(page);
  const prefix = vertical === 'plumbing' ? 'plumb' : 'hvac';

  console.log('\n' + '='.repeat(60));
  console.log(`=== ${vertical.toUpperCase()} PATH 1: GET AN ESTIMATE ===`);
  console.log('='.repeat(60));

  try {
    await page.goto(`${BASE}/${vertical}-estimate.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded. Title:', await page.title());
    await page.screenshot({ path: `${OUTDIR}/${vertical}-est-01-landing.png`, fullPage: true });

    // Fill split address fields
    await page.type('#addrStreet', '123 Main St');
    await page.type('#addrCity', 'Charlotte');
    await page.type('#addrState', 'NC');
    await page.type('#addrZip', '28202');
    console.log('Address filled');

    // Click "Get [Vertical] Estimate"
    await page.click('#btnEstimate');
    console.log('Clicked Get Estimate button');
    await sleep(3000);
    await page.screenshot({ path: `${OUTDIR}/${vertical}-est-02-step1.png`, fullPage: true });

    // Step through the wizard
    for (let step = 0; step < 10; step++) {
      // Check if we have a price result
      const hasPrice = await page.evaluate(() => {
        return /\$[\d,]+\s*[-\u2013]\s*\$[\d,]+/.test(document.body.innerText);
      });
      if (hasPrice) {
        console.log(`  Step ${step}: PRICE RANGE FOUND`);
        break;
      }

      // 1. Try clicking option cards
      const optionSelector = `.${prefix}-option:not(.selected)`;
      const option = await page.$(optionSelector);

      // 2. Also check for number inputs (home size)
      const numInput = await page.$('input[type="number"]:not([style*="display: none"])');
      const numVisible = numInput ? await numInput.evaluate(el => el.offsetParent !== null) : false;

      // 3. Check for Continue/Next button
      const continueBtn = await page.$('#detailsNext') || await page.$('#continueBtn');

      if (numVisible && continueBtn) {
        // This is the "describe your home" step -- fill sqft + stories + click continue
        // First pick stories if available
        if (option) {
          await page.click(optionSelector);
          const optText = await page.evaluate(sel => {
            const el = document.querySelector(sel + '.selected') || document.querySelector(sel);
            return el ? el.textContent.trim() : '?';
          }, '.' + prefix + '-option');
          console.log(`  Step ${step}: selected stories`);
          await sleep(500);
        }
        // Fill sqft
        await numInput.click({ clickCount: 3 });
        await numInput.type('2000');
        console.log(`  Step ${step}: entered 2000 sqft`);
        await sleep(500);
        // Click continue
        await continueBtn.click();
        console.log(`  Step ${step}: clicked Continue`);
        await sleep(2000);
      } else if (option) {
        const text = await option.evaluate(el => el.textContent.trim());
        await page.click(optionSelector);
        console.log(`  Step ${step}: clicked "${text}"`);
        await sleep(2000);
      } else {
        // Try any visible button
        const clicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null && !b.disabled);
          for (const b of btns) {
            const t = b.textContent.toLowerCase();
            if (t.includes('continue') || t.includes('next') || t.includes('estimate')) {
              b.click();
              return b.textContent.trim();
            }
          }
          return null;
        });
        if (clicked) {
          console.log(`  Step ${step}: clicked button "${clicked}"`);
          await sleep(2000);
        } else {
          console.log(`  Step ${step}: stuck -- no options or buttons`);
          break;
        }
      }

      await page.screenshot({ path: `${OUTDIR}/${vertical}-est-s${step}.png`, fullPage: true });
    }

    await sleep(2000);
    await page.screenshot({ path: `${OUTDIR}/${vertical}-est-03-result.png`, fullPage: true });

    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      const prices = text.match(/\$[\d,]+/g);
      return {
        prices: prices ? prices.slice(0, 15) : [],
        hasRange: /\$[\d,]+\s*[-\u2013]\s*\$[\d,]+/.test(text),
        snippet: text.substring(0, 2000)
      };
    });
    console.log('Prices:', result.prices.join(', ') || 'NONE');
    console.log('Has price range:', result.hasRange);
    console.log('Page text (700 chars):', result.snippet.substring(0, 700));

    // Mobile
    await page.setViewport({ width: 375, height: 812 });
    await sleep(1000);
    await page.screenshot({ path: `${OUTDIR}/${vertical}-est-04-mobile.png`, fullPage: true });
    console.log('Console errors:', errors.length ? errors.join(' | ') : 'none');
  } catch (err) {
    console.log('FATAL:', err.message);
    await page.screenshot({ path: `${OUTDIR}/${vertical}-est-error.png`, fullPage: true }).catch(() => {});
  }
  await page.close();
}

// ========== ANALYZER PATH ==========
async function testAnalyzer(browser, vertical) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = await collectErrors(page);

  console.log('\n' + '='.repeat(60));
  console.log(`=== ${vertical.toUpperCase()} PATH 2: ANALYZE A QUOTE ===`);
  console.log('='.repeat(60));

  try {
    await page.goto(`${BASE}/${vertical}-quote-analyzer.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded. Title:', await page.title());
    await page.screenshot({ path: `${OUTDIR}/${vertical}-ana-01-landing.png`, fullPage: true });

    // Use comparison image (smaller, clean text for OCR)
    const imgDir = `${vertical}-images`;
    const imgPath = path.join(FIXTURES, imgDir);
    const files = fs.readdirSync(imgPath).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
    const testImg = files.find(f => f.startsWith('comparison-')) || files[0];
    const fullImgPath = path.join(imgPath, testImg);
    console.log(`Test image: ${testImg} (${(fs.statSync(fullImgPath).size/1024).toFixed(0)} KB)`);

    const fileInput = await page.$('#fileInput') || await page.$('input[type="file"]');
    if (!fileInput) { console.log('ERROR: No file input'); await page.close(); return; }
    await fileInput.uploadFile(fullImgPath);
    console.log('File uploaded. Waiting for OCR...');

    // Wait for OCR to find price or show manual entry
    let state = 'loading';
    for (let wait = 0; wait < 12; wait++) {
      await sleep(5000);
      const check = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasVerdict: /verdict|fair|overpriced|reasonable|about right|good deal/i.test(text),
          hasFoundPrice: /we found your quote total/i.test(text),
          hasManualEntry: /enter your quote total|couldn't read/i.test(text),
          stillLoading: /analyzing|reading text|processing/i.test(text),
        };
      });
      console.log(`  ${(wait+1)*5}s: verdict=${check.hasVerdict} foundPrice=${check.hasFoundPrice} manual=${check.hasManualEntry} loading=${check.stillLoading}`);
      if (check.hasVerdict) { state = 'done'; break; }
      if (check.hasFoundPrice) { state = 'confirm'; break; }
      if (check.hasManualEntry) { state = 'manual'; break; }
    }

    await page.screenshot({ path: `${OUTDIR}/${vertical}-ana-02-ocr.png`, fullPage: true });

    // Handle confirmation or manual entry
    if (state === 'confirm') {
      console.log('OCR found a price, clicking "Yes, analyze this price"...');
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        for (const b of btns) {
          if (/yes.*analyze|analyze this price/i.test(b.textContent)) {
            b.click();
            return b.textContent.trim();
          }
        }
        return null;
      });
      console.log('Clicked:', clicked || 'not found');
      // Wait for verdict
      for (let w = 0; w < 8; w++) {
        await sleep(5000);
        const done = await page.evaluate(() => /verdict|fair|overpriced|reasonable|about right|good deal|typical|low|high/i.test(document.body.innerText));
        console.log(`  ${(w+1)*5}s after confirm: verdict=${done}`);
        if (done) break;
      }
    } else if (state === 'manual') {
      console.log('OCR failed, entering price manually...');
      const priceInput = await page.$('input[type="number"]') || await page.$('input[inputmode="decimal"]');
      if (priceInput) {
        await priceInput.click({ clickCount: 3 });
        const price = vertical === 'plumbing' ? '3500' : '8500';
        await priceInput.type(price);
        const clicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          for (const b of btns) {
            if (/analyze/i.test(b.textContent)) { b.click(); return b.textContent.trim(); }
          }
          return null;
        });
        console.log(`Entered $${price}, clicked:`, clicked || 'none');
        await sleep(10000);
      }
    }

    await page.screenshot({ path: `${OUTDIR}/${vertical}-ana-03-result.png`, fullPage: true });

    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      const prices = text.match(/\$[\d,]+/g);
      return {
        prices: prices ? prices.slice(0, 15) : [],
        hasVerdict: /verdict|fair|overpriced|reasonable|about right|good deal|typical|slightly|low|high/i.test(text),
        hasLineItems: document.querySelectorAll('table tr, .line-item, .quote-item, .item-row, .breakdown-item').length,
        hasRedFlags: /red flag|warning|concern|flag|watch out|missing/i.test(text),
        snippet: text.substring(0, 2500)
      };
    });
    console.log('Prices:', result.prices.join(', ') || 'NONE');
    console.log('Has verdict:', result.hasVerdict);
    console.log('Line items:', result.hasLineItems);
    console.log('Has red flags:', result.hasRedFlags);
    console.log('Page text (1000 chars):', result.snippet.substring(0, 1000));

    // Mobile
    await page.setViewport({ width: 375, height: 812 });
    await sleep(1000);
    await page.screenshot({ path: `${OUTDIR}/${vertical}-ana-04-mobile.png`, fullPage: true });
    console.log('Console errors:', errors.length ? errors.join(' | ') : 'none');
  } catch (err) {
    console.log('FATAL:', err.message);
    await page.screenshot({ path: `${OUTDIR}/${vertical}-ana-error.png`, fullPage: true }).catch(() => {});
  }
  await page.close();
}

// ========== COMPARE PATH ==========
async function testCompare(browser, vertical) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = await collectErrors(page);

  console.log('\n' + '='.repeat(60));
  console.log(`=== ${vertical.toUpperCase()} PATH 3: COMPARE QUOTES ===`);
  console.log('='.repeat(60));

  try {
    await page.goto(`${BASE}/compare-${vertical}-quotes.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded. Title:', await page.title());
    await page.screenshot({ path: `${OUTDIR}/${vertical}-cmp-01-landing.png`, fullPage: true });

    const imgDir = `${vertical}-images`;
    const imgPath = path.join(FIXTURES, imgDir);
    const compFiles = fs.readdirSync(imgPath).filter(f => f.startsWith('comparison-') && /\.(png|jpg|jpeg)$/i.test(f));
    console.log('Comparison images:', compFiles);

    if (compFiles.length < 2) { console.log('ERROR: Need 2+'); await page.close(); return; }

    const f0 = await page.$('#file0');
    const f1 = await page.$('#file1');
    if (!f0 || !f1) { console.log('ERROR: No #file0/#file1'); await page.close(); return; }

    await f0.uploadFile(path.join(imgPath, compFiles[0]));
    console.log('Uploaded quote 1:', compFiles[0]);
    await sleep(1000);
    await f1.uploadFile(path.join(imgPath, compFiles[1]));
    console.log('Uploaded quote 2:', compFiles[1]);

    // Wait for parsing to finish
    for (let w = 0; w < 12; w++) {
      await sleep(3000);
      const check = await page.evaluate(() => /parsing|reading/i.test(document.body.innerText));
      if (!check) { console.log(`  Parsing done after ${(w+1)*3}s`); break; }
      console.log(`  ${(w+1)*3}s: still parsing...`);
    }

    await page.screenshot({ path: `${OUTDIR}/${vertical}-cmp-02-parsed.png`, fullPage: true });

    // Click "Compare 2 quotes" button
    const compareClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const b of btns) {
        if (/compare.*quote/i.test(b.textContent) && !b.disabled) {
          b.click();
          return b.textContent.trim();
        }
      }
      return null;
    });
    console.log('Clicked:', compareClicked || 'no Compare button found');

    // Wait for comparison results
    for (let w = 0; w < 10; w++) {
      await sleep(5000);
      const check = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasWinner: /winner|better deal|best value|cheaper|lower price|recommended/i.test(text),
          hasComparison: /comparison|side.by.side|quote 1|quote 2/i.test(text),
          stillLoading: /comparing|analyzing|loading/i.test(text),
          snippet: text.substring(0, 200)
        };
      });
      console.log(`  ${(w+1)*5}s: winner=${check.hasWinner} comparison=${check.hasComparison} loading=${check.stillLoading}`);
      if (check.hasWinner || check.hasComparison) { console.log('  Results found!'); break; }
    }

    await page.screenshot({ path: `${OUTDIR}/${vertical}-cmp-03-result.png`, fullPage: true });

    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      const prices = text.match(/\$[\d,]+/g);
      return {
        prices: prices ? prices.slice(0, 20) : [],
        hasWinner: /winner|better deal|best value|cheaper|recommended/i.test(text),
        hasComparison: /quote 1|quote 2|comparison/i.test(text),
        tableCount: document.querySelectorAll('table').length,
        snippet: text.substring(0, 3000)
      };
    });
    console.log('Prices:', result.prices.join(', ') || 'NONE');
    console.log('Has winner:', result.hasWinner);
    console.log('Has comparison:', result.hasComparison);
    console.log('Tables:', result.tableCount);
    console.log('Page text (1200 chars):', result.snippet.substring(0, 1200));

    // Mobile
    await page.setViewport({ width: 375, height: 812 });
    await sleep(1000);
    await page.screenshot({ path: `${OUTDIR}/${vertical}-cmp-04-mobile.png`, fullPage: true });
    console.log('Console errors:', errors.length ? errors.join(' | ') : 'none');
  } catch (err) {
    console.log('FATAL:', err.message);
    await page.screenshot({ path: `${OUTDIR}/${vertical}-cmp-error.png`, fullPage: true }).catch(() => {});
  }
  await page.close();
}

// ========== MAIN ==========
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  try {
    await testEstimate(browser, 'plumbing');
    await testAnalyzer(browser, 'plumbing');
    await testCompare(browser, 'plumbing');
    await testEstimate(browser, 'hvac');
    await testAnalyzer(browser, 'hvac');
    await testCompare(browser, 'hvac');
  } catch (e) {
    console.error('Top-level error:', e.message, e.stack);
  } finally {
    await browser.close();
    console.log('\n=== ALL 6 TESTS COMPLETE ===');
  }
})();
