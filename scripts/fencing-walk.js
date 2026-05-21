// Fencing deep-dive walk: estimate (Lane's address, multiple permutations) +
// analyze (real fixture) + compare (3 comparison-fence fixtures).
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "fencing-walk-2026-04-27");
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
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36");
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });
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
    if (/error|fail|verdict|TP_Engine|400|500/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function dumpResultText(page, name) {
  const txt = await page.evaluate(() => {
    const el = document.getElementById("fenceApp") || document.querySelector("main");
    return el ? (el.innerText || "").slice(0, 5000) : "(no fenceApp)";
  });
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}

async function fillAddressAndStart(page) {
  await page.waitForSelector("#addrStreet", { timeout: 10000 });
  await page.evaluate(() => {
    document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
    document.getElementById("addrCity").value = "Fort Mill";
    document.getElementById("addrState").value = "SC";
    document.getElementById("addrZip").value = "29707";
  });
  await sleep(300);
  await page.click("#btnEstimate");
  await sleep(1500);
}

async function pickOption(page, containerId, val) {
  const ok = await page.evaluate((cid, v) => {
    const o = document.querySelector(`#${cid} [data-val="${v}"]`);
    if (o) { o.click(); return true; }
    return false;
  }, containerId, val);
  if (!ok) console.log(`  [pick] could not click ${containerId} ${val}`);
  await sleep(700);
}

async function runEstimateWalk(browser, label, picks) {
  const page = await newPage(browser, label);
  console.log(`\n=== ESTIMATE: ${label} ===`);
  await page.goto(`${BASE}/fencing-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(1500);
  await shot(page, `${label}-01-landing`);
  await fillAddressAndStart(page);
  await shot(page, `${label}-02-step1-fenceType`);

  await pickOption(page, "optType", picks.fenceType);
  await shot(page, `${label}-03-step2-length`);

  await pickOption(page, "optLength", picks.length);
  await shot(page, `${label}-04-step3-height`);

  await pickOption(page, "optHeight", picks.height);
  await shot(page, `${label}-05-step4-gate`);

  await pickOption(page, "optGate", picks.gate);
  await shot(page, `${label}-06-step5-terrain`);

  await pickOption(page, "optTerrain", picks.terrain);
  await shot(page, `${label}-07-step6-demo`);

  await pickOption(page, "optDemo", picks.demo);
  await sleep(2000);
  await shot(page, `${label}-08-result-top`);
  await shot(page, `${label}-09-result-full`, true);
  await dumpResultText(page, `${label}-09-result`);
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process"
    ]
  });

  // ─── ESTIMATE PATH — multiple permutations ────────────────────────
  // Pick 1: Cedar privacy 180lf 6ft + gate + flat + demo (matches comparison fixtures scenario)
  await runEstimateWalk(browser, "estimate-cedar", {
    fenceType: "cedar", length: "200", height: "6", gate: "yes", terrain: "flat", demo: "yes"
  });
  // Pick 2: Wood privacy 150lf 6ft no gate flat no demo (most common)
  await runEstimateWalk(browser, "estimate-wood", {
    fenceType: "wood_privacy", length: "150", height: "6", gate: "no", terrain: "flat", demo: "no"
  });
  // Pick 3: Chain link 4ft 100lf no gate
  await runEstimateWalk(browser, "estimate-chainlink", {
    fenceType: "chain_link", length: "100", height: "4", gate: "no", terrain: "flat", demo: "no"
  });
  // Pick 4: Vinyl 8ft 250lf gate steep terrain
  await runEstimateWalk(browser, "estimate-vinyl-steep", {
    fenceType: "vinyl_privacy", length: "250", height: "8", gate: "yes", terrain: "steep", demo: "yes"
  });
  // Pick 5: Aluminum ornamental 6ft 200lf gate gentle
  await runEstimateWalk(browser, "estimate-aluminum", {
    fenceType: "aluminum", length: "200", height: "6", gate: "yes", terrain: "gentle", demo: "no"
  });
  // Pick 6: Wrought iron 4ft 100lf no gate (premium)
  await runEstimateWalk(browser, "estimate-wrought", {
    fenceType: "wrought_iron", length: "100", height: "4", gate: "no", terrain: "flat", demo: "no"
  });

  // ─── ANALYZE PATH — real fixture ──────────────────────────────
  const fixtures = [
    {
      id: "real02",
      file: "real-02-1600-ft-of-6-wire-t-post-fence-with-some-braces-is.jpg",
      note: "$18,025 — 1600ft 6-strand wire ag fence (NOT residential), Quote $9/lf"
    }
  ];

  for (const fx of fixtures) {
    const page = await newPage(browser, `analyze-${fx.id}`);
    console.log(`\n=== ANALYZE: ${fx.note} ===`);
    await page.goto(`${BASE}/fencing-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);

    const fixture = path.join(ROOT, "test-quotes/fencing-images", fx.file);
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      console.log(`  [skip ${fx.id}] no file input found`);
      await shot(page, `analyze-${fx.id}-NOINPUT`, true);
      await page.close();
      continue;
    }
    await fileInput.uploadFile(fixture);
    console.log(`  uploaded: ${fx.file}`);

    const start = Date.now();
    let got = false;
    while (Date.now() - start < 120000) {
      await sleep(2000);
      const seen = await page.evaluate(() => {
        const t = (document.getElementById("fenceApp")?.innerText || "");
        return t.includes("Quote Analysis") || t.includes("couldn") || t.includes("Verdict") || t.includes("manual");
      });
      if (seen) { got = true; break; }
    }
    await shot(page, `analyze-${fx.id}-result`, true);
    await dumpResultText(page, `analyze-${fx.id}-result`);
    if (!got) console.log(`  [${fx.id}] timed out waiting for result`);
    await page.close();
  }

  // ─── COMPARE PATH — low / mid / high ────────────────────
  {
    const page = await newPage(browser, "compare");
    console.log("\n=== COMPARE: low/mid/high (180ft 6ft cedar privacy 2 gates Raleigh NC) ===");
    await page.goto(`${BASE}/compare-fencing-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "compare-01-landing");

    const cmpFiles = [
      "comparison-fence-low.png",
      "comparison-fence-mid.png",
      "comparison-fence-high.png"
    ];
    for (let i = 0; i < cmpFiles.length; i++) {
      const fixture = path.join(ROOT, "test-quotes/fencing-images", cmpFiles[i]);
      const inp = await page.$(`#file${i}`);
      if (!inp) { console.log(`  [skip] no #file${i}`); continue; }
      await inp.uploadFile(fixture);
      console.log(`  uploaded slot ${i}: ${cmpFiles[i]}`);
      await sleep(3000);
    }
    await shot(page, "compare-02-after-uploads", true);

    const start = Date.now();
    let clicked = false;
    while (Date.now() - start < 60000) {
      const ok = await page.evaluate(() => {
        const btn = document.querySelector(".cmp-compare-btn, button[onclick*='compare'], #compareBtn");
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      });
      if (ok) { clicked = true; break; }
      await sleep(1500);
    }
    if (clicked) {
      console.log("  clicked compare button");
      await sleep(8000);
    } else {
      console.log("  could not find/click compare button");
    }
    await shot(page, "compare-03-results", true);
    await dumpResultText(page, "compare-03-results");
    await page.close();
  }

  await browser.close();
  console.log("\nDONE — output:", OUT);
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
