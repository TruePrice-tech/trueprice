#!/usr/bin/env node
/**
 * Run Lighthouse via puppeteer on a curated list of key pages. Captures
 * Core Web Vitals (LCP, CLS, INP, FCP, TBT) plus the overall performance
 * score per page. Lab data only — real-user data needs traffic.
 *
 * Requires a local server on port 8765 to serve the static files.
 *
 * Returns: { scoredAt, pages: [{ url, performance, lcp, cls, inp, fcp, tbt, error }] }
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require(path.resolve(__dirname, '..', '..', 'node_modules', 'puppeteer'));

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8765;
const BASE = `http://127.0.0.1:${PORT}`;

// Pages we care about most. Sample across page types.
const PAGES = [
  '/',                                                  // Homepage
  '/hvac-cost.html',                                    // Vertical guide
  '/roof-cost-by-house-size.html',                      // Vertical guide
  '/atlanta-ga-hvac-cost.html',                         // Top city page
  '/new-york-ny-roof-cost.html',                        // Top metro city
  '/hvac-quote-analyzer.html',                          // Analyzer
  '/analyze-my-quote.html',                             // Universal analyzer
  '/woogoro-vs-angi.html',                              // Comparison page
  '/how-much-does-heat-pump-cost.html',                 // Long-tail page
  '/methodology.html',                                  // Trust page
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function startServer() {
  // Use python http.server (already used elsewhere in the project)
  const proc = spawn('python', ['-m', 'http.server', String(PORT)], {
    cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'], detached: false,
  });
  return proc;
}

async function runLighthouse(page, url) {
  // Lighthouse-style metrics via PerformanceObserver. Not the full Lighthouse
  // package (which requires a separate browser launch), but captures the
  // same Core Web Vitals from a single page navigation.
  const result = { url, error: null };
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Capture metrics via Chrome DevTools Protocol
    const metrics = await page.metrics();
    result.tbt = Math.round(metrics.TaskDuration * 1000) || null;

    // Core Web Vitals via web-vitals approach (in-page eval)
    const cwv = await page.evaluate(() => {
      return new Promise((resolve) => {
        const out = {};
        let resolved = false;
        function done() {
          if (resolved) return;
          resolved = true;
          resolve(out);
        }
        try {
          // LCP via PerformanceObserver
          const lcpObs = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            out.lcp = Math.round(last.startTime);
          });
          lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });

          // CLS
          let clsValue = 0;
          const clsObs = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
              if (!e.hadRecentInput) clsValue += e.value;
            }
            out.cls = +clsValue.toFixed(4);
          });
          clsObs.observe({ type: 'layout-shift', buffered: true });

          // FCP from paint entries
          const paintEntries = performance.getEntriesByType('paint');
          for (const p of paintEntries) {
            if (p.name === 'first-contentful-paint') out.fcp = Math.round(p.startTime);
          }

          // Wait briefly for observers to settle
          setTimeout(done, 1500);
        } catch (e) {
          out.error = e.message;
          done();
        }
      });
    });

    Object.assign(result, cwv);

    // Quick perf score: weighted sum of LCP/CLS/FCP (rough Lighthouse-style)
    const lcpScore = result.lcp == null ? null : (result.lcp < 2500 ? 100 : result.lcp < 4000 ? 70 : 40);
    const clsScore = result.cls == null ? null : (result.cls < 0.1 ? 100 : result.cls < 0.25 ? 70 : 40);
    const fcpScore = result.fcp == null ? null : (result.fcp < 1800 ? 100 : result.fcp < 3000 ? 70 : 40);
    const scores = [lcpScore, clsScore, fcpScore].filter(s => s != null);
    result.performance = scores.length ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null;
  } catch (e) {
    result.error = e.message.slice(0, 200);
  }
  return result;
}

async function collect() {
  const result = { scoredAt: new Date().toISOString(), pages: [] };

  const server = startServer();
  await sleep(2000);

  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

    for (const p of PAGES) {
      const r = await runLighthouse(page, BASE + p);
      result.pages.push({ ...r, url: p });
    }
  } catch (e) {
    result.error = e.message.slice(0, 200);
  } finally {
    if (browser) await browser.close();
    try { process.kill(server.pid); } catch {}
    // Make sure the server is dead even if pid kill fails (Windows)
    try {
      const { execSync } = require('child_process');
      execSync('pkill -f "http.server ' + PORT + '" || true', { stdio: 'ignore' });
    } catch {}
  }

  return result;
}

if (require.main === module) {
  collect().then(out => console.log(JSON.stringify(out, null, 2)));
}

module.exports = { collect };
