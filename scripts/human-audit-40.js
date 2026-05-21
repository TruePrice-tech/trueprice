// scripts/human-audit-40.js
//
// Captures clean terminal-state screenshots of the 40 billable paths
// for genuine visual audit. Different from earlier walkers in that:
//
// - Analyzers: uploads vertical-matching fixture where possible, else
//   roofing fixture for hard-reject test. Waits up to 90s for terminal
//   state via h1 detection (multiple terminal h1 patterns supported).
// - Compares: uploads to specific Quote 1/Quote 2 inputs, then clicks
//   #compareBtn DIRECTLY (no text matching). Waits for results render.
//
// Output: one fullPage screenshot per path in output/human-audit-40/<ts>/
// Then I read each screenshot and build a findings list.

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = "https://woogoro.com";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "output", "human-audit-40", new Date().toISOString().replace(/[:.]/g, "-"));
const FIX = path.join(ROOT, "test", "receipt", "ocr-cache", "fixtures");

// Per-vertical fixture map. happyPath uses vertical-matching fixture (expect verdict).
// negativePath uses roofing fixture (expect hard-reject for non-roofing verticals).
const FIXTURES = {
  roofing:    { happy: "roofing-gaf-quote.jpeg", neg: "hvac-clean-invoice.jpeg" },
  hvac:       { happy: "hvac-clean-invoice.jpeg", neg: "roofing-gaf-quote.jpeg" },
  auto_repair:{ happy: "auto-equinox-quote.jpeg", neg: "roofing-gaf-quote.jpeg" },
  // For 17 verticals without happy fixture: upload roofing -> expect reject.
  // No happy-path screenshot for these tonight.
};

const ANALYZERS = [
  { slug: "roofing",    url: "/roofing-quote-analyzer.html" },
  { slug: "hvac",       url: "/hvac-quote-analyzer.html" },
  { slug: "plumbing",   url: "/plumbing-quote-analyzer.html" },
  { slug: "electrical", url: "/electrical-quote-analyzer.html" },
  { slug: "windows",    url: "/window-quote-analyzer.html" },
  { slug: "siding",     url: "/siding-quote-analyzer.html" },
  { slug: "insulation", url: "/insulation-quote-analyzer.html" },
  { slug: "painting",   url: "/painting-quote-analyzer.html" },
  { slug: "fencing",    url: "/fencing-quote-analyzer.html" },
  { slug: "concrete",   url: "/concrete-quote-analyzer.html" },
  { slug: "landscaping",url: "/landscaping-quote-analyzer.html" },
  { slug: "garage_door",url: "/garage-door-quote-analyzer.html" },
  { slug: "solar",      url: "/solar-quote-analyzer.html" },
  { slug: "foundation", url: "/foundation-quote-analyzer.html" },
  { slug: "kitchen",    url: "/kitchen-quote-analyzer.html" },
  { slug: "gutters",    url: "/gutters-quote-analyzer.html" },
  { slug: "moving",     url: "/moving-quote-analyzer.html" },
  { slug: "auto_repair",url: "/auto-repair.html" },
  { slug: "medical",    url: "/medical-bill-analyzer.html" },
  { slug: "legal",      url: "/legal-fee-analyzer.html" },
];

const COMPARES = [
  { slug: "roofing",    url: "/compare-roofing-quotes.html" },
  { slug: "hvac",       url: "/compare-hvac-quotes.html" },
  { slug: "plumbing",   url: "/compare-plumbing-quotes.html" },
  { slug: "electrical", url: "/compare-electrical-quotes.html" },
  { slug: "windows",    url: "/compare-windows-quotes.html" },
  { slug: "siding",     url: "/compare-siding-quotes.html" },
  { slug: "insulation", url: "/compare-insulation-quotes.html" },
  { slug: "painting",   url: "/compare-painting-quotes.html" },
  { slug: "fencing",    url: "/compare-fencing-quotes.html" },
  { slug: "concrete",   url: "/compare-concrete-quotes.html" },
  { slug: "landscaping",url: "/compare-landscaping-quotes.html" },
  { slug: "garage_door",url: "/compare-garage-door-quotes.html" },
  { slug: "solar",      url: "/compare-solar-quotes.html" },
  { slug: "foundation", url: "/compare-foundation-quotes.html" },
  { slug: "kitchen",    url: "/compare-kitchen-quotes.html" },
  { slug: "gutters",    url: "/compare-gutters-quotes.html" },
  { slug: "moving",     url: "/compare-moving-quotes.html" },
  { slug: "auto",       url: "/compare-auto-quotes.html" },
  { slug: "medical",    url: "/compare-medical-quotes.html" },
  { slug: "legal",      url: "/compare-legal-quotes.html" },
];

async function shot(page, name) {
  try {
    await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  } catch (e) {
    // Some pages are extremely tall; fallback to viewport-only screenshot.
    try { await page.screenshot({ path: path.join(OUT, name), fullPage: false }); } catch (e2) { /* swallow */ }
  }
}

async function walkAnalyzer(browser, v) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1500 });
  console.log(`\n[A:${v.slug}] ${v.url}`);

  try {
    await page.goto(BASE + v.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));

    // Auto-repair needs the "I Have a Quote" click first
    if (v.slug === "auto_repair") {
      await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll(".ar-path-btn, button"));
        for (const c of cards) if (/i have a quote/i.test(c.textContent || "")) { c.click(); return; }
      });
      await new Promise((r) => setTimeout(r, 2000));
    }

    const inputs = await page.$$('input[type="file"]');
    if (inputs.length === 0) {
      console.log("  no file input");
      await shot(page, `${v.slug}-A-no-input.png`);
      await page.close();
      return { slug: v.slug, ok: false, reason: "no_file_input" };
    }

    // Pick fixture
    const f = FIXTURES[v.slug];
    const fixName = f ? f.happy : "roofing-gaf-quote.jpeg";
    const expectingReject = !f;
    await inputs[0].uploadFile(path.join(FIX, fixName));
    console.log(`  uploaded ${fixName} (expecting ${expectingReject ? "reject" : "happy path"})`);

    // Wait for terminal state — broader regex than before
    try {
      await page.waitForFunction(() => {
        const h1 = document.querySelector("h1")?.textContent || "";
        const text = document.body.textContent || "";
        if (/this is not a/i.test(h1)) return true;
        if (/we found your quote total|is this your quote/i.test(text.slice(0, 3000))) return true;
        if (/quote analysis|your verdict|looks (fair|low|high)|notably/i.test(text.slice(0, 3000))) return true;
        if (/add your roof size for the price verdict/i.test(text.slice(0, 3000))) return true;
        return false;
      }, { timeout: 90000, polling: 2000 });
    } catch (e) {
      console.log("  terminal-state timeout");
    }
    await new Promise((r) => setTimeout(r, 3000));
    await shot(page, `${v.slug}-A.png`);

    const state = await page.evaluate(() => ({
      h1: (document.querySelector("h1")?.textContent || "").trim().slice(0, 100),
      bodyLen: (document.body.textContent || "").length,
      hasReject: /this is not a/i.test(document.body.textContent || ""),
      hasUpsell: !!document.querySelector(".tp-pro-inline-cta, .tp-pro-upsell"),
    }));
    console.log(`  state:`, JSON.stringify(state));
    await page.close();
    return { slug: v.slug, ok: true, state, fixture: fixName, expectingReject };
  } catch (e) {
    console.log("  error:", e.message);
    await page.close().catch(() => {});
    return { slug: v.slug, ok: false, error: e.message };
  }
}

async function walkCompare(browser, v) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1500 });
  console.log(`\n[C:${v.slug}] ${v.url}`);

  try {
    await page.goto(BASE + v.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2500));

    const inputs = await page.$$('input[type="file"]');
    console.log(`  ${inputs.length} file inputs`);

    // Try to use vertical-matching fixtures where possible
    const f = FIXTURES[v.slug];
    let fix1, fix2;
    if (f && f.happy) {
      // For 3 verticals with 2 fixtures available
      const pairs = {
        roofing: ["roofing-gaf-quote.jpeg", "roofing-scope-doc.png"],
        hvac: ["hvac-clean-invoice.jpeg", "hvac-coil-quote.jpeg"],
        auto: ["auto-equinox-quote.jpeg", "auto-honda-paper-photo.jpeg"],
      };
      const pair = pairs[v.slug];
      if (pair) { fix1 = path.join(FIX, pair[0]); fix2 = path.join(FIX, pair[1]); }
      else { fix1 = fix2 = path.join(FIX, f.happy); }
    } else {
      fix1 = path.join(FIX, "roofing-gaf-quote.jpeg");
      fix2 = path.join(FIX, "roofing-scope-doc.png");
    }
    if (inputs[0]) await inputs[0].uploadFile(fix1);
    await new Promise((r) => setTimeout(r, 2000));
    if (inputs[1]) await inputs[1].uploadFile(fix2);
    await new Promise((r) => setTimeout(r, 5000));

    // Wait for parse, then click #compareBtn (the actual button id, not text)
    try {
      await page.waitForFunction(() => {
        const btn = document.getElementById("compareBtn");
        return btn && !btn.disabled;
      }, { timeout: 60000, polling: 1500 });
      await page.evaluate(() => document.getElementById("compareBtn")?.click());
      console.log("  clicked #compareBtn");
    } catch (e) {
      console.log("  compareBtn never enabled within 60s");
    }

    // Wait for results to render
    try {
      await page.waitForFunction(() => {
        const rc = document.getElementById("resultsContent");
        return rc && rc.children && rc.children.length > 0;
      }, { timeout: 90000, polling: 2000 });
      console.log("  results rendered");
    } catch (e) {
      console.log("  results never rendered");
    }
    await new Promise((r) => setTimeout(r, 4000));
    await shot(page, `${v.slug}-C.png`);

    const state = await page.evaluate(() => ({
      h1: (document.querySelector("h1")?.textContent || "").trim().slice(0, 100),
      hasResultsContent: !!document.getElementById("resultsContent")?.children?.length,
      hasReject: /this is not a/i.test(document.body.textContent || ""),
    }));
    console.log(`  state:`, JSON.stringify(state));
    await page.close();
    return { slug: v.slug, ok: true, state };
  } catch (e) {
    console.log("  error:", e.message);
    await page.close().catch(() => {});
    return { slug: v.slug, ok: false, error: e.message };
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`Human audit -> ${OUT}`);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
    protocolTimeout: 180000,
  });

  const report = { startedAt: new Date().toISOString(), analyzers: [], compares: [] };

  for (const v of ANALYZERS) {
    report.analyzers.push(await walkAnalyzer(browser, v));
  }
  for (const v of COMPARES) {
    report.compares.push(await walkCompare(browser, v));
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\nDone. Output: ${OUT}`);
})();
