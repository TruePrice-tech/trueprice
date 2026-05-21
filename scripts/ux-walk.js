#!/usr/bin/env node
/**
 * ux-walk.js — animation + UX walkthrough of woogoro.com
 *
 * Focused on:
 *   - Animations (multi-frame capture during transitions)
 *   - 3D / parallax / hero motion
 *   - Hover states
 *   - Recently changed pages (get-an-estimate, roofing analyzer)
 *   - Burrow (animation-heavy, recently shipped)
 *   - Critical vertical paths
 *
 * Reads as a human: screenshots saved with descriptive names so they can
 * be opened and judged visually.
 */
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = path.dirname(__dirname);
const OUT = path.join(ROOT, "output", "ux-walk-2026-04-26");
const BASE = process.env.BASE || "https://woogoro.com";
const VIEWPORT_DESKTOP = { width: 1280, height: 900 };
const VIEWPORT_MOBILE = { width: 390, height: 844 };

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  shot: ${name}`);
}

async function shotFull(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  shot (full): ${name}`);
}

async function scrollAndShot(page, name, steps = 4) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = await page.evaluate(() => window.innerHeight);
  for (let i = 0; i < steps; i++) {
    const y = Math.floor((h - vh) * (i / (steps - 1 || 1)));
    await page.evaluate(yy => window.scrollTo({ top: yy, behavior: "instant" }), y);
    await sleep(400);
    await shot(page, `${name}-scroll-${i}`);
  }
  // Reset
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
}

async function captureAnimation(page, name, ms = 2000, frames = 5) {
  // Capture multiple frames over ms duration
  const interval = ms / (frames - 1);
  for (let i = 0; i < frames; i++) {
    await sleep(interval);
    await shot(page, `${name}-anim-${i}`);
  }
}

async function visit(browser, url, name, opts = {}) {
  const page = await browser.newPage();
  await page.setViewport(opts.viewport || VIEWPORT_DESKTOP);
  console.log(`\n=== ${name} (${url}) ===`);
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(800);
    await shot(page, `${name}-initial`);
    if (opts.scroll) await scrollAndShot(page, name);
    if (opts.fullPage) await shotFull(page, `${name}-full`);
    if (opts.afterMs) {
      await sleep(opts.afterMs);
      await shot(page, `${name}-settled`);
    }
    if (opts.captureAnimation) {
      await captureAnimation(page, name, opts.animMs || 2000, opts.animFrames || 5);
    }
    if (opts.click) {
      try {
        await page.click(opts.click);
        await sleep(opts.clickWait || 800);
        await shot(page, `${name}-after-click`);
      } catch (e) {
        console.log(`  (click ${opts.click} failed: ${e.message})`);
      }
    }
  } catch (e) {
    console.log(`  ERROR loading ${url}: ${e.message}`);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log(`UX walk against ${BASE}`);
  console.log(`Output: ${OUT}\n`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  // 1. Homepage - desktop
  await visit(browser, `${BASE}/`, "01-home", {
    scroll: true,
    fullPage: true,
    afterMs: 1500
  });

  // 2. Recently changed: get-an-estimate (verify Iris bg removal)
  await visit(browser, `${BASE}/get-an-estimate.html`, "02-get-estimate", {
    fullPage: true,
    afterMs: 1500
  });

  // 3. Recently changed: roofing analyzer estimator mode (verify duplicate fix)
  await visit(browser, `${BASE}/roofing-quote-analyzer.html?mode=estimator`, "03-roofing-estimator", {
    fullPage: true,
    afterMs: 2500
  });

  // 4. Roofing upload mode (also fixed duplicate)
  await visit(browser, `${BASE}/roofing-quote-analyzer.html?mode=upload`, "04-roofing-upload", {
    fullPage: true,
    afterMs: 2500
  });

  // 5. Roofing default mode (no mode param)
  await visit(browser, `${BASE}/roofing-quote-analyzer.html`, "05-roofing-default", {
    fullPage: true,
    afterMs: 2500
  });

  // 6. Analyze quote picker
  await visit(browser, `${BASE}/analyze-my-quote.html`, "06-analyze-picker", {
    fullPage: true,
    afterMs: 1000
  });

  // 7. Compare quotes picker
  await visit(browser, `${BASE}/compare-quotes-picker.html`, "07-compare-picker", {
    fullPage: true,
    afterMs: 1000
  });

  // 8. Burrow (animation-heavy)
  await visit(browser, `${BASE}/beta/burrow.html`, "08-burrow", {
    fullPage: true,
    afterMs: 1000,
    captureAnimation: true,
    animMs: 4000,
    animFrames: 8
  });

  // 9. HVAC analyzer (consistency check vs roofing)
  await visit(browser, `${BASE}/hvac-quote-analyzer.html?mode=estimator`, "09-hvac-estimator", {
    fullPage: true,
    afterMs: 2500
  });

  // 10. Plumbing analyzer
  await visit(browser, `${BASE}/plumbing-quote-analyzer.html?mode=estimator`, "10-plumbing-estimator", {
    fullPage: true,
    afterMs: 2500
  });

  // 11. Solar analyzer
  await visit(browser, `${BASE}/solar-quote-analyzer.html?mode=estimator`, "11-solar-estimator", {
    fullPage: true,
    afterMs: 2500
  });

  // 12. Medical bill analyzer
  await visit(browser, `${BASE}/medical-bill-analyzer.html`, "12-medical-analyzer", {
    fullPage: true,
    afterMs: 2500
  });

  // 13. Legal fee analyzer
  await visit(browser, `${BASE}/legal-fee-analyzer.html`, "13-legal-analyzer", {
    fullPage: true,
    afterMs: 2500
  });

  // 14. Medical cost guide
  await visit(browser, `${BASE}/medical-cost-guide.html`, "14-medical-guide", {
    fullPage: true,
    scroll: true,
    afterMs: 1500
  });

  // 15. Legal cost guide
  await visit(browser, `${BASE}/legal-cost-guide.html`, "15-legal-guide", {
    fullPage: true,
    scroll: true,
    afterMs: 1500
  });

  // 16. Guides hub
  await visit(browser, `${BASE}/guides.html`, "16-guides-hub", {
    fullPage: true,
    afterMs: 1000
  });

  // 17. About page
  await visit(browser, `${BASE}/about.html`, "17-about", {
    fullPage: true,
    scroll: true,
    afterMs: 1500
  });

  // 18. Methodology
  await visit(browser, `${BASE}/methodology.html`, "18-methodology", {
    fullPage: true,
    scroll: true,
    afterMs: 1500
  });

  // 19. Terms (verify the new Section 32 renders)
  await visit(browser, `${BASE}/terms.html`, "19-terms", {
    fullPage: true,
    scroll: true,
    afterMs: 1000
  });

  // 20. Mobile homepage
  await visit(browser, `${BASE}/`, "20-home-MOBILE", {
    viewport: VIEWPORT_MOBILE,
    scroll: true,
    fullPage: true,
    afterMs: 1500
  });

  // 21. Mobile get-an-estimate
  await visit(browser, `${BASE}/get-an-estimate.html`, "21-get-estimate-MOBILE", {
    viewport: VIEWPORT_MOBILE,
    fullPage: true,
    afterMs: 1500
  });

  // 22. Mobile roofing analyzer
  await visit(browser, `${BASE}/roofing-quote-analyzer.html?mode=estimator`, "22-roofing-estimator-MOBILE", {
    viewport: VIEWPORT_MOBILE,
    fullPage: true,
    afterMs: 2500
  });

  // 23. Mobile burrow
  await visit(browser, `${BASE}/beta/burrow.html`, "23-burrow-MOBILE", {
    viewport: VIEWPORT_MOBILE,
    fullPage: true,
    afterMs: 1500
  });

  await browser.close();
  console.log(`\nDone. ${fs.readdirSync(OUT).length} screenshots in ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
