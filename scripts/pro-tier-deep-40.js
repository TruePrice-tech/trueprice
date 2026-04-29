// scripts/pro-tier-deep-40.js
//
// Deep walk on the 40 billable paths (20 analyzers + 20 compares).
// For each: upload fixture(s), wait for terminal state (verdict OR
// hard-reject OR confirmation), screenshot. Visual review by Claude
// after the run.
//
// Coverage strategy:
//   - 3 analyzers have vertical-specific fixtures (roofing, hvac, auto):
//     happy-path test. Expect verdict + Pro upsell.
//   - Other 17 analyzers get a roofing fixture: NEGATIVE test —
//     expect hard-reject screen ("This is not a Plumbing quote", etc).
//     This proves the trust safeguard works site-wide.
//   - 20 compare pages: upload 2 fixtures (vertical-matching where we
//     have 2 of the same type, otherwise 2 different roofing fixtures),
//     try to click Compare button, screenshot results.

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = "https://woogoro.com";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "output", "pro-tier-deep-40", new Date().toISOString().replace(/[:.]/g, "-"));
const FIX = path.join(ROOT, "test", "receipt", "ocr-cache", "fixtures");

const VERT_FIXTURES = {
  roofing:  { match: ["roofing-gaf-quote.jpeg", "roofing-scope-doc.png"], crossUpload: "roofing-gaf-quote.jpeg" },
  hvac:     { match: ["hvac-clean-invoice.jpeg", "hvac-coil-quote.jpeg"], crossUpload: "hvac-clean-invoice.jpeg" },
  auto_repair: { match: ["auto-equinox-quote.jpeg", "auto-honda-paper-photo.jpeg"], crossUpload: "auto-equinox-quote.jpeg" },
};

const ANALYZERS = [
  { slug: "roofing",    url: "/roofing-quote-analyzer.html",      vertical: "roofing", expect: "happy" },
  { slug: "hvac",       url: "/hvac-quote-analyzer.html",         vertical: "hvac",    expect: "happy" },
  { slug: "auto_repair",url: "/auto-repair.html",                 vertical: "auto_repair", expect: "happy" },
  // The 17 below use a roofing fixture: expect HARD REJECT
  { slug: "plumbing",    url: "/plumbing-quote-analyzer.html",    vertical: "plumbing",    expect: "reject" },
  { slug: "electrical",  url: "/electrical-quote-analyzer.html",  vertical: "electrical",  expect: "reject" },
  { slug: "windows",     url: "/window-quote-analyzer.html",      vertical: "windows",     expect: "reject" },
  { slug: "siding",      url: "/siding-quote-analyzer.html",      vertical: "siding",      expect: "reject" },
  { slug: "insulation",  url: "/insulation-quote-analyzer.html",  vertical: "insulation",  expect: "reject" },
  { slug: "painting",    url: "/painting-quote-analyzer.html",    vertical: "painting",    expect: "reject" },
  { slug: "fencing",     url: "/fencing-quote-analyzer.html",     vertical: "fencing",     expect: "reject" },
  { slug: "concrete",    url: "/concrete-quote-analyzer.html",    vertical: "concrete",    expect: "reject" },
  { slug: "landscaping", url: "/landscaping-quote-analyzer.html", vertical: "landscaping", expect: "reject" },
  { slug: "garage_door", url: "/garage-door-quote-analyzer.html", vertical: "garage_door", expect: "reject" },
  { slug: "solar",       url: "/solar-quote-analyzer.html",       vertical: "solar",       expect: "reject" },
  { slug: "foundation",  url: "/foundation-quote-analyzer.html",  vertical: "foundation",  expect: "reject" },
  { slug: "kitchen",     url: "/kitchen-quote-analyzer.html",     vertical: "kitchen",     expect: "reject" },
  { slug: "gutters",     url: "/gutters-quote-analyzer.html",     vertical: "gutters",     expect: "reject" },
  { slug: "moving",      url: "/moving-quote-analyzer.html",      vertical: "moving",      expect: "reject" },
  { slug: "medical",     url: "/medical-bill-analyzer.html",      vertical: "medical",     expect: "reject" },
  { slug: "legal",       url: "/legal-fee-analyzer.html",         vertical: "legal",       expect: "reject" },
];

const COMPARES = [
  { slug: "cmp_roofing",    url: "/compare-roofing-quotes.html",    fixtures: ["roofing-gaf-quote.jpeg", "roofing-scope-doc.png"] },
  { slug: "cmp_hvac",       url: "/compare-hvac-quotes.html",       fixtures: ["hvac-clean-invoice.jpeg", "hvac-coil-quote.jpeg"] },
  { slug: "cmp_auto",       url: "/compare-auto-quotes.html",       fixtures: ["auto-equinox-quote.jpeg", "auto-honda-paper-photo.jpeg"] },
  // The rest use 2 roofing fixtures (will exercise compare flow but content will be wrong-vertical)
  { slug: "cmp_plumbing",   url: "/compare-plumbing-quotes.html",   fixtures: null },
  { slug: "cmp_electrical", url: "/compare-electrical-quotes.html", fixtures: null },
  { slug: "cmp_windows",    url: "/compare-windows-quotes.html",    fixtures: null },
  { slug: "cmp_siding",     url: "/compare-siding-quotes.html",     fixtures: null },
  { slug: "cmp_insulation", url: "/compare-insulation-quotes.html", fixtures: null },
  { slug: "cmp_painting",   url: "/compare-painting-quotes.html",   fixtures: null },
  { slug: "cmp_fencing",    url: "/compare-fencing-quotes.html",    fixtures: null },
  { slug: "cmp_concrete",   url: "/compare-concrete-quotes.html",   fixtures: null },
  { slug: "cmp_landscaping",url: "/compare-landscaping-quotes.html",fixtures: null },
  { slug: "cmp_garage_door",url: "/compare-garage-door-quotes.html",fixtures: null },
  { slug: "cmp_solar",      url: "/compare-solar-quotes.html",      fixtures: null },
  { slug: "cmp_foundation", url: "/compare-foundation-quotes.html", fixtures: null },
  { slug: "cmp_kitchen",    url: "/compare-kitchen-quotes.html",    fixtures: null },
  { slug: "cmp_gutters",    url: "/compare-gutters-quotes.html",    fixtures: null },
  { slug: "cmp_moving",     url: "/compare-moving-quotes.html",     fixtures: null },
  { slug: "cmp_medical",    url: "/compare-medical-quotes.html",    fixtures: null },
  { slug: "cmp_legal",      url: "/compare-legal-quotes.html",      fixtures: null },
];

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}

async function clickByText(page, texts) {
  return await page.evaluate((texts) => {
    const cands = Array.from(document.querySelectorAll("button, a, [onclick], [role=button], .btn, .ar-btn, .plumb-btn"));
    for (const t of texts) {
      const tl = t.toLowerCase();
      for (const el of cands) {
        const txt = (el.textContent || "").trim().toLowerCase();
        if (txt === tl || txt.includes(tl)) {
          if (el.offsetParent || el.tagName === "A") { el.click(); return t; }
        }
      }
    }
    return null;
  }, texts);
}

async function captureTerminalState(page, label) {
  return await page.evaluate(() => {
    const h1 = document.querySelector("h1")?.textContent?.trim() || "";
    const text = (document.body.textContent || "").slice(0, 4000);
    return {
      h1,
      isReject: /this is not a/i.test(h1),
      isVerdict: /quote analysis|looks (fair|low|high)|notably/i.test(text.slice(0, 500)),
      isConfirm: /we found your quote total|is this your quote/i.test(h1 + text.slice(0, 500)),
      isAnalyzing: /analyzing your/i.test(h1),
      hasUpsell: !!document.querySelector(".tp-pro-inline-cta"),
      hasFakePrice: /\$16,7\d\d|\$16,8\d\d/.test(text), // GAF quote was $16,765.79
    };
  });
}

async function walkAnalyzer(browser, v) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1600 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  console.log(`\n[A:${v.slug}] ${v.expect.toUpperCase()} ${v.url}`);
  try {
    await page.goto(BASE + v.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));

    // Auto-repair: click "I Have a Quote" to reveal upload
    if (v.slug === "auto_repair") {
      const clicked = await clickByText(page, ["I Have a Quote"]);
      console.log("  auto-repair path click:", clicked);
      await new Promise((r) => setTimeout(r, 2000));
    }

    const inputs = await page.$$('input[type="file"]');
    if (inputs.length === 0) {
      console.log("  no file input");
      await shot(page, `${v.slug}-no-input.png`);
      await page.close();
      return { slug: v.slug, expect: v.expect, ok: false, reason: "no_file_input" };
    }

    // Pick fixture: vertical-specific where we have it, else roofing for negative-test
    const fixName = v.expect === "happy"
      ? (VERT_FIXTURES[v.vertical]?.crossUpload || "roofing-gaf-quote.jpeg")
      : "roofing-gaf-quote.jpeg";
    await inputs[0].uploadFile(path.join(FIX, fixName));
    console.log(`  uploaded ${fixName}`);

    // Wait for terminal state
    try {
      await page.waitForFunction(() => {
        const h1 = document.querySelector("h1")?.textContent || "";
        return /this is not a/i.test(h1) || /we found your quote/i.test(h1)
          || /quote analysis/i.test(h1) || /looks (fair|low|high)|verdict/i.test(h1);
      }, { timeout: 90000, polling: 1500 });
    } catch (e) {
      console.log("  terminal-state timeout");
    }
    await new Promise((r) => setTimeout(r, 3000));
    await shot(page, `${v.slug}-final.png`);

    const state = await captureTerminalState(page);
    state.errors = errors.length;
    console.log(`  state:`, JSON.stringify(state).slice(0, 200));

    // Verdict per expect
    let verdict = "unknown";
    if (v.expect === "reject") verdict = state.isReject ? "PASS" : "FAIL (no reject)";
    else if (v.expect === "happy") {
      if (state.isVerdict || state.isConfirm) verdict = "PASS";
      else if (state.isAnalyzing) verdict = "TIMEOUT (still analyzing)";
      else verdict = "FAIL";
    }
    console.log(`  verdict: ${verdict}`);
    await page.close();
    return { slug: v.slug, expect: v.expect, ok: verdict === "PASS", verdict, state };
  } catch (e) {
    console.log("  error:", e.message);
    await page.close().catch(() => {});
    return { slug: v.slug, expect: v.expect, ok: false, error: e.message };
  }
}

async function walkCompare(browser, v) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1600 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  const fixtures = (v.fixtures || ["roofing-gaf-quote.jpeg", "roofing-scope-doc.png"]).map((f) => path.join(FIX, f));
  console.log(`\n[C:${v.slug}] ${v.url}`);
  try {
    await page.goto(BASE + v.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2500));

    const inputs = await page.$$('input[type="file"]');
    console.log(`  ${inputs.length} file inputs`);
    if (inputs.length >= 1) await inputs[0].uploadFile(fixtures[0]);
    await new Promise((r) => setTimeout(r, 3000));
    if (inputs.length >= 2) await inputs[1].uploadFile(fixtures[1] || fixtures[0]);
    await new Promise((r) => setTimeout(r, 3000));

    // Click Compare button
    const clicked = await clickByText(page, [
      "Compare these quotes", "Compare 2 quotes", "Compare quotes", "Show comparison", "Compare",
    ]);
    console.log("  compare click:", clicked);

    // Wait for results to render
    await new Promise((r) => setTimeout(r, 30000));
    await shot(page, `${v.slug}-final.png`);

    const state = await captureTerminalState(page);
    state.errors = errors.length;
    console.log(`  state:`, JSON.stringify(state).slice(0, 200));
    await page.close();
    return { slug: v.slug, ok: !state.isAnalyzing, state };
  } catch (e) {
    console.log("  error:", e.message);
    await page.close().catch(() => {});
    return { slug: v.slug, ok: false, error: e.message };
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`Deep walk -> ${OUT}`);
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  const report = { startedAt: new Date().toISOString(), analyzers: [], compares: [] };

  // Phase 1: 20 analyzers (sequential, since they're slow individually)
  for (const v of ANALYZERS) {
    const r = await walkAnalyzer(browser, v);
    report.analyzers.push(r);
  }

  // Phase 2: 20 compares
  for (const v of COMPARES) {
    const r = await walkCompare(browser, v);
    report.compares.push(r);
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

  console.log("\n=== ANALYZER SUMMARY ===");
  for (const r of report.analyzers) {
    console.log(`  ${r.ok ? "PASS" : "FAIL"}  [${r.expect}]  ${r.slug}  ${r.verdict || r.error || ""}`);
  }
  const aPass = report.analyzers.filter((r) => r.ok).length;
  console.log(`\n${aPass}/20 analyzers passed expectation`);

  console.log("\n=== COMPARE SUMMARY ===");
  for (const r of report.compares) {
    console.log(`  ${r.ok ? "OK" : "FAIL"}  ${r.slug}  ${r.error || (r.state ? "h1=" + r.state.h1 : "")}`);
  }
  const cPass = report.compares.filter((r) => r.ok).length;
  console.log(`${cPass}/20 compares produced terminal state`);

  console.log(`\nScreenshots: ${OUT}`);
})();
