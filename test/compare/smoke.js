#!/usr/bin/env node
// Compare path smoke test harness.
// Uploads 2 synthetic fixtures (low + mid) to each compare page,
// verifies both slots parse successfully.
//
// Usage:
//   node test/compare/smoke.js                    # all verticals
//   node test/compare/smoke.js hvac concrete      # specific verticals
//   BASE_URL=http://localhost:3000 node test/compare/smoke.js

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "https://truepricehq.com";
const FIXTURES_ROOT = path.resolve(__dirname, "..", "..", "test-quotes");

// Map vertical -> compare page path + fixture naming
const VERTICALS = {
  hvac:          { page: "/compare-hvac-quotes.html",        fixtures: "hvac-images",        prefix: "comparison-ac-",     low: "01-low.png",  mid: "02-mid.png" },
  plumbing:      { page: "/compare-plumbing-quotes.html",    fixtures: "plumbing-images",    prefix: "comparison-wh-",     low: "01-low.png",  mid: "02-mid.png" },
  roofing:       { page: "/compare-roofing-quotes.html",     fixtures: "roofing-images",     prefix: "comparison-roof-",   low: "01-low.png",  mid: "02-mid.png" },
  auto:          { page: "/compare-auto-quotes.html",        fixtures: "auto-images",        prefix: "comparison-brake-",  low: "01-shop-a-low.png", mid: "02-shop-b-mid.png" },
  siding:        { page: "/compare-siding-quotes.html",      fixtures: "siding-images",      prefix: "comparison-siding-", low: "low.png",     mid: "mid.png" },
  concrete:      { page: "/compare-concrete-quotes.html",    fixtures: "concrete-images",    prefix: "comparison-conc-",   low: "low.png",     mid: "mid.png" },
  electrical:    { page: "/compare-electrical-quotes.html",  fixtures: "electrical-images",  prefix: "comparison-panel-",  low: "01-low.png",  mid: "02-mid.png" },
  fencing:       { page: "/compare-fencing-quotes.html",     fixtures: "fencing-images",     prefix: "comparison-fence-",  low: "low.png",     mid: "mid.png" },
  foundation:    { page: "/compare-foundation-quotes.html",  fixtures: "foundation-images",  prefix: "comparison-pier-",   low: "low.png",     mid: "mid.png" },
  "garage-door": { page: "/compare-garage-door-quotes.html", fixtures: "garage-door-images", prefix: "comparison-garage-", low: "low.png",     mid: "mid.png" },
  gutters:       { page: "/compare-gutters-quotes.html",     fixtures: "gutters-images",     prefix: "comparison-gutters-",low: "low.png",     mid: "mid.png" },
  insulation:    { page: "/compare-insulation-quotes.html",  fixtures: "insulation-images",  prefix: "comparison-insul-",  low: "low.png",     mid: "mid.png" },
  kitchen:       { page: "/compare-kitchen-quotes.html",     fixtures: "kitchen-images",     prefix: "comparison-kitchen-",low: "low.png",     mid: "mid.png" },
  landscaping:   { page: "/compare-landscaping-quotes.html", fixtures: "landscaping-images", prefix: "comparison-land-",   low: "low.png",     mid: "mid.png" },
  moving:        { page: "/compare-moving-quotes.html",      fixtures: "moving-images",      prefix: "comparison-move-",   low: "low.png",     mid: "mid.png" },
  painting:      { page: "/compare-painting-quotes.html",    fixtures: "painting-images",    prefix: "comparison-paint-",  low: "low.png",     mid: "mid.png" },
  solar:         { page: "/compare-solar-quotes.html",       fixtures: "solar-images",       prefix: "comparison-solar-",  low: "01-low.png",  mid: "02-mid.png" },
  windows:       { page: "/compare-windows-quotes.html",     fixtures: "windows-images",     prefix: "comparison-windows-",low: "low.png",     mid: "mid.png" },
};

const requested = process.argv.slice(2);
const toTest = requested.length ? requested : Object.keys(VERTICALS);

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const results = [];

  for (const v of toTest) {
    const cfg = VERTICALS[v];
    if (!cfg) { console.log(v + ": UNKNOWN vertical"); continue; }

    const img1 = path.join(FIXTURES_ROOT, cfg.fixtures, cfg.prefix + cfg.low);
    const img2 = path.join(FIXTURES_ROOT, cfg.fixtures, cfg.prefix + cfg.mid);

    if (!fs.existsSync(img1) || !fs.existsSync(img2)) {
      console.log(v + ": SKIP (fixtures missing)");
      results.push({ v, status: "SKIP", reason: "fixtures" });
      continue;
    }

    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message.slice(0, 100)));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text().slice(0, 100));
    });

    const t0 = Date.now();
    let status = "FAIL", s0 = "?", s1 = "?", reason = "";

    try {
      await page.goto(BASE_URL + cfg.page, { waitUntil: "networkidle2", timeout: 30000 });
      const inputs = await page.$$('input[type="file"]');
      if (inputs.length < 2) { reason = "no file inputs"; throw new Error(reason); }

      await inputs[0].uploadFile(img1);
      await new Promise(r => setTimeout(r, 2000));
      await inputs[1].uploadFile(img2);

      await page.waitForFunction(() => {
        const a = document.getElementById("slot0");
        const b = document.getElementById("slot1");
        if (!a || !b) return false;
        return (a.classList.contains("uploaded") || a.innerText.includes("Could not")) &&
               (b.classList.contains("uploaded") || b.innerText.includes("Could not"));
      }, { timeout: 120000 });

      const state = await page.evaluate(() => ({
        s0: document.getElementById("slot0")?.classList.contains("uploaded"),
        s1: document.getElementById("slot1")?.classList.contains("uploaded"),
        s0err: document.getElementById("slot0")?.innerText?.includes("Could not"),
        s1err: document.getElementById("slot1")?.innerText?.includes("Could not"),
        btnEnabled: !document.querySelector(".cmp-compare-btn")?.disabled
      }));

      s0 = state.s0 ? "OK" : (state.s0err ? "PARSE_FAIL" : "UNKNOWN");
      s1 = state.s1 ? "OK" : (state.s1err ? "PARSE_FAIL" : "UNKNOWN");
      status = (s0 === "OK" && s1 === "OK") ? "PASS" : "FAIL";
      if (status === "FAIL") reason = "s0:" + s0 + " s1:" + s1;

    } catch (e) {
      reason = reason || e.message.slice(0, 80);
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    await page.close();

    results.push({ v, status, s0, s1, elapsed, errors: errors.length, reason });
    const icon = status === "PASS" ? "PASS" : status === "SKIP" ? "SKIP" : "FAIL";
    console.log(icon.padEnd(6) + v.padEnd(15) + "s0:" + s0.padEnd(12) + "s1:" + s1.padEnd(12) + elapsed + "s" + (reason ? "  " + reason : ""));
  }

  await browser.close();

  const pass = results.filter(r => r.status === "PASS").length;
  const fail = results.filter(r => r.status === "FAIL").length;
  const skip = results.filter(r => r.status === "SKIP").length;
  console.log("\n" + pass + "/" + (pass + fail) + " PASS   " + fail + " FAIL   " + skip + " SKIP");
  process.exit(fail > 0 ? 1 : 0);
})();
