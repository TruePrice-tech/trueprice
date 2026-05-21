// Roofing deep dive: estimate (Lane's address) + 2 real fixtures + compare
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "roofing-walk-2026-04-27");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

async function newPage(browser, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    } else {
      req.continue();
    }
  });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|TP_Engine|400|verdict|funnel/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─── PATH 1: ESTIMATE — Lane's address, ?mode=estimator ─────────────
  {
    const page = await newPage(browser, "estimate");
    console.log("\n=== PATH 1: ROOFING ESTIMATE — Fort Mill SC, replacement/architectural/2-story/2675sqft ===");
    await page.goto(`${BASE}/roofing-quote-analyzer.html?mode=estimator`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2500);
    await shot(page, "01-estimate-landing");

    await page.evaluate(() => {
      const set = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event("input", {bubbles: true})); el.dispatchEvent(new Event("change", {bubbles: true})); } };
      set("journeyStreetAddress", "17064 Laurelmont Ct");
      set("journeyCity", "Fort Mill");
      set("journeyState", "SC");
      set("journeyZipCode", "29707");
    });
    await sleep(500);
    await shot(page, "02-estimate-address-filled");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /get my estimate/i.test((b.textContent || "").trim()));
      if (t) t.click();
    });
    await sleep(3500);
    await shot(page, "03-estimate-questions-top", true);

    // Click ONE option per question group (avoid the click-first-card bug)
    const answers = {
      workType: "replacement",
      season: "fall",
      material: "architectural",
      steepness: "normal",
      complexity: "complex",
      insurance: "no",
      propertyType: "two_story",
      ownership: "yes"
    };
    await page.evaluate((answers) => {
      Object.entries(answers).forEach(([group, val]) => {
        const card = document.querySelector(`button.est-option[data-group="${group}"][data-value="${val}"]`);
        if (card) card.click();
      });
      // Override with Lane's actual living area (3,200), not OSM-detected
      const sz = document.getElementById("estHomeSize");
      if (sz) { sz.value = "3200"; sz.dispatchEvent(new Event("input", {bubbles: true})); }
    }, answers);
    await sleep(800);
    await shot(page, "04-estimate-answers-selected", true);

    await page.evaluate(() => {
      const btn = document.getElementById("estSubmitBtn");
      if (btn) btn.click();
    });
    console.log("  clicked Build my estimate");
    await sleep(4000);
    await shot(page, "05-estimate-result-top");
    await shot(page, "06-estimate-result-full", true);

    await page.close();
  }

  // ─── PATH 2: ANALYZE — 2 real Reddit fixtures ──────────────────────
  const fixtures = [
    { id: "03", file: "03-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg", note: "Metal standing seam $136,375 (overpriced?)" },
    { id: "07", file: "07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg", note: "Asphalt 30yr architectural $10,500 / 12-12 steep" }
  ];
  for (const fx of fixtures) {
    const page = await newPage(browser, `analyze-${fx.id}`);
    console.log(`\n=== PATH 2.${fx.id}: ANALYZE — ${fx.note} ===`);
    await page.goto(`${BASE}/roofing-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2500);

    // Roofing analyzer doesn't ask for address upfront, just upload
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      // Probe what state it's in
      const txt = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.log("  no file input. body:", txt.replace(/\n+/g, " | ").substring(0, 200));
      await shot(page, `${fx.id}-21-no-input`);
      await page.close();
      continue;
    }
    await fileInput.uploadFile(path.join(ROOT, "test-quotes/roofing-images", fx.file));
    console.log("  uploaded:", fx.file);

    const start1 = Date.now();
    let phase = null;
    while (Date.now() - start1 < 90000) {
      await sleep(2500);
      phase = await page.evaluate(() => {
        const visible = (e) => e && e.offsetParent !== null;
        const btns = Array.from(document.querySelectorAll("button")).filter(visible);
        const confirm = btns.find(b => /yes,?\s+analyze\s+this\s+price|confirm|continue with this/i.test((b.textContent || "").trim()));
        if (confirm && !confirm.disabled) return "confirm";
        const verdictHit = !!document.querySelector('[class*="verdict"], [data-verdict]');
        if (verdictHit) return "verdict_direct";
        return null;
      });
      if (phase) break;
    }
    console.log("  phase:", phase, "after", Math.round((Date.now() - start1) / 1000) + "s");
    await shot(page, `${fx.id}-21-confirm-step`);

    if (phase === "confirm") {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const t = btns.find(b => /yes,?\s+analyze\s+this\s+price|confirm|continue with this/i.test((b.textContent || "").trim()));
        if (t) t.click();
      });
      const start2 = Date.now();
      while (Date.now() - start2 < 90000) {
        await sleep(2500);
        const done = await page.evaluate(() => !!document.querySelector('[class*="verdict"], [data-verdict]'));
        if (done) break;
      }
      await sleep(1500);
    } else if (phase === "verdict_direct") {
      await sleep(1500);
    }
    await shot(page, `${fx.id}-22-result-top`);
    await shot(page, `${fx.id}-23-result-full`, true);

    await page.close();
  }

  // ─── PATH 3: COMPARE — 3 synthetic fixtures ────────────────────────
  {
    const page = await newPage(browser, "compare");
    console.log("\n=== PATH 3: COMPARE — Budget vs Heritage vs Pinnacle ===");
    await page.goto(`${BASE}/compare-roofing-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2500);
    await shot(page, "30-compare-landing");

    const cmp = ["comparison-roof-01-low.png", "comparison-roof-02-mid.png", "comparison-roof-03-high.png"];
    const inputs = await page.$$('input[type="file"]');
    console.log("  file inputs:", inputs.length);
    for (let i = 0; i < Math.min(cmp.length, inputs.length); i++) {
      await inputs[i].uploadFile(path.join(ROOT, "test-quotes/roofing-images", cmp[i]));
      await sleep(700);
    }

    const start1 = Date.now();
    let buttonReady = false;
    while (Date.now() - start1 < 120000) {
      await sleep(2000);
      buttonReady = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const t = btns.find(b => /^Compare\s+3\s+quotes?/i.test((b.textContent || "").trim()));
        return !!(t && !t.disabled && t.offsetParent !== null);
      });
      if (buttonReady) break;
    }
    console.log("  Compare ready:", buttonReady);
    if (buttonReady) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const t = btns.find(b => /^Compare\s+3\s+quotes?/i.test((b.textContent || "").trim()));
        if (t) t.click();
      });
      await sleep(4500);
      await shot(page, "31-compare-result-top");
      await shot(page, "32-compare-result-full", true);
    }
    await page.close();
  }

  await browser.close();
  console.log("\nDONE. Output:", OUT);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
