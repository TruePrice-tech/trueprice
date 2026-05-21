// Smoke-test Pro API endpoints via Puppeteer to bypass Vercel security checkpoint.
const puppeteer = require('puppeteer-core');
const fs = require('fs');

function findChrome() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

(async () => {
  const exec = findChrome();
  if (!exec) { console.error('No browser found'); process.exit(1); }
  const browser = await puppeteer.launch({ headless: 'new', executablePath: exec, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36');

  // Visit homepage first to clear any Vercel security check
  console.log('Warming up via homepage...');
  await page.goto('https://woogoro.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  async function probe(name, url, opts = {}) {
    const result = await page.evaluate(async ({ url, opts }) => {
      try {
        const res = await fetch(url, opts);
        const text = await res.text();
        let parsed = null;
        try { parsed = JSON.parse(text); } catch {}
        return { ok: true, status: res.status, body: parsed || text.slice(0, 500) };
      } catch (e) { return { ok: false, error: String(e) }; }
    }, { url, opts });
    console.log(`[${name}] ${result.status || 'ERR'} -> ${JSON.stringify(result.body || result.error)}`);
    return result;
  }

  console.log('\n--- Endpoint smoke tests ---');
  await probe('pro-status invalid', '/api/pro-status?token=notvalid');
  await probe('pro-status valid format unknown', '/api/pro-status?token=' + 'a'.repeat(32));
  await probe('pro-firstview empty', '/api/pro-firstview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}' });
  await probe('pro-firstview unknown token', '/api/pro-firstview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ token: 'a'.repeat(32) }) });
  await probe('pro-refund empty', '/api/pro-refund', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}' });
  await probe('pro-refund unknown token', '/api/pro-refund', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ token: 'a'.repeat(32) }) });
  await probe('pro-checkout no body', '/api/pro-checkout', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}' });

  console.log('\n--- Live JS bundle check ---');
  const jsCheck = await page.evaluate(async () => {
    const res = await fetch('/js/pro-tier.min.js?_check=' + Date.now());
    const text = await res.text();
    return { status: res.status, size: text.length, hasIsPremium: text.includes('is-premium'), hasFirstView: text.includes('pro-firstview'), hasRefundCopy: text.includes('cooling-off') || text.includes('cooling') };
  });
  console.log(`pro-tier.min.js: ${JSON.stringify(jsCheck)}`);

  await browser.close();
  console.log('\nSmoke tests done.');
})().catch(e => { console.error(e); process.exit(1); });
