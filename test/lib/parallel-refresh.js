// Shared parallel OCR refresh helper. Spins up N puppeteer pages in parallel
// against the live analyzer page, uploads each fixture, captures
// window.__TP_LAST_OCR_TEXT, writes <fixture>.txt to cache.
//
// Usage from a vertical's refresh.js:
//   require("../../lib/parallel-refresh")({
//     fixturesDir: ".../test-quotes/<vertical>-images",
//     cacheDir: __dirname,
//     analyzerPath: "/plumbing-quote-analyzer.html?path=quote",
//     workers: 4
//   });
//
// Flags from CLI:
//   node refresh.js                  → all fixtures, default workers
//   node refresh.js fixture.png      → single fixture
//   node refresh.js --workers 8      → override worker count
//   WORKERS=2 node refresh.js        → env override
//   BASE_URL=http://localhost:3000 node refresh.js

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

module.exports = async function parallelRefresh(opts) {
  const {
    fixturesDir,
    cacheDir,
    analyzerPath,
    workers: defaultWorkers = 4,
    timeoutMs = 240000
  } = opts;

  const argv = process.argv.slice(2);
  const ONLY = argv.find(a => !a.startsWith("--") && !/^\d+$/.test(a)) || null;
  const workersFlagIdx = argv.indexOf("--workers");
  const cliWorkers = workersFlagIdx >= 0 ? Number(argv[workersFlagIdx + 1]) : null;
  const WORKERS = cliWorkers || Number(process.env.WORKERS) || defaultWorkers;
  const BASE_URL = process.env.BASE_URL || "https://truepricehq.com";

  let files = fs.readdirSync(fixturesDir).filter(n => /\.(jpe?g|png|webp)$/i.test(n)).sort();
  if (ONLY) files = files.filter(n => n === ONLY);
  if (!files.length) {
    console.log("No matching fixtures.");
    return;
  }

  console.log(`Parallel refresh: ${files.length} fixtures, ${WORKERS} workers, target ${BASE_URL}${analyzerPath}`);
  const tStart = Date.now();

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  // Simple work queue: each worker pulls from `pending` until empty.
  const pending = files.slice();
  const results = [];

  async function worker(id) {
    while (pending.length) {
      const name = pending.shift();
      if (!name) break;
      const t0 = Date.now();
      const page = await browser.newPage();
      let textLen = 0;
      let status = "ok";
      try {
        await page.goto(`${BASE_URL}${analyzerPath}`, { waitUntil: "networkidle2", timeout: 60000 });
        await page.waitForSelector('input[type="file"]', { timeout: 30000 });
        const [input] = await page.$$('input[type="file"]');
        await input.uploadFile(path.join(fixturesDir, name));
        // Wait specifically for OCR text. Don't fall back to body-text matching
        // for "verdict|fair" because some analyzer pages (e.g. auto-repair.html)
        // pre-render the result template containing those words before OCR runs,
        // causing the wait to fire instantly with 0 captured text. Only allow
        // manualPrice as an early-out — that's an explicit "OCR pipeline failed,
        // user must enter manually" signal.
        await page.waitForFunction(
          () => {
            if (window.__TP_LAST_OCR_TEXT) return true;
            // Only treat manual fallback as success if we've actually waited a bit —
            // the manualPrice element might also appear in the upload form template.
            const m = document.getElementById("manualPrice");
            return !!m && document.body.innerText && document.body.innerText.length > 100;
          },
          { timeout: timeoutMs, polling: 500 }
        );
        const text = await page.evaluate(() => window.__TP_LAST_OCR_TEXT || "");
        fs.writeFileSync(path.join(cacheDir, name + ".txt"), text);
        textLen = text.length;
      } catch (e) {
        status = "FAIL: " + e.message.slice(0, 80);
      }
      await page.close();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const tag = status === "ok" ? `${textLen} chars` : status;
      console.log(`[w${id}] ${name}  ${elapsed}s  ${tag}`);
      results.push({ name, status, textLen, elapsed });
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i + 1)));
  await browser.close();

  const totalElapsed = ((Date.now() - tStart) / 1000).toFixed(1);
  const ok = results.filter(r => r.status === "ok").length;
  const failed = results.length - ok;
  console.log(`\nDone: ${ok}/${results.length} succeeded, ${failed} failed in ${totalElapsed}s total`);
};
